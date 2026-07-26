# Stellar Soroban Faucet Smart Contract Refactor & Architecture Guide

## 1. Executive Summary

This guide details the updated architecture, smart contract implementation, and usage instructions for the **Nexus Soroban Faucet Contract** (`nexus-faucet-contract`). 

The Faucet is engineered to support multi-asset testing on Stellar Testnet for P2P Lending, Collateralized Escrow, and Atomic Swaps. It supports **Token A (USDC)**, **Token B (Collateral / XYZ)**, and native asset flows with full rate limiting, authorization safety, and single-transaction **Batch Claims**.

---

## 2. Refactored Faucet Smart Contract (`contracts/faucet/src/lib.rs`)

```rust
#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token::{StellarAssetClient, TokenClient},
    Address, Env, Vec,
};

const LEDGERS_PER_DAY: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * LEDGERS_PER_DAY;
const TTL_EXTEND_TO: u32 = 365 * LEDGERS_PER_DAY;

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub struct AssetConfig {
    pub claim_amount: i128,
    pub cooldown_ledgers: u32,
    pub enabled: bool,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Asset(Address),
    LastClaim(Address, Address), // (recipient, asset) -> ledger_sequence
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic!("faucet not initialized"))
}

fn require_admin(env: &Env) {
    let admin = get_admin(env);
    admin.require_auth();
}

#[contract]
pub struct FaucetContract;

#[contractimpl]
impl FaucetContract {
    /// Initialize Faucet contract with admin governance
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("faucet already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        bump_instance(&env);
    }

    /// Admin configuration per asset (Token A, Token B, etc.)
    pub fn set_asset_config(
        env: Env,
        asset: Address,
        claim_amount: i128,
        cooldown_ledgers: u32,
        enabled: bool,
    ) {
        require_admin(&env);
        if claim_amount <= 0 {
            panic!("claim amount must be positive");
        }

        let config = AssetConfig {
            claim_amount,
            cooldown_ledgers,
            enabled,
        };

        env.storage().persistent().set(&DataKey::Asset(asset), &config);
        bump_instance(&env);
    }

    /// Query eligibility and remaining cooldown ledgers
    pub fn get_eligibility(env: Env, recipient: Address, asset: Address) -> (bool, u32) {
        let config: AssetConfig = match env.storage().persistent().get::<DataKey, AssetConfig>(&DataKey::Asset(asset.clone())) {
            Some(cfg) if cfg.enabled => cfg,
            _ => return (false, 0),
        };

        let current_ledger = env.ledger().sequence();
        let last_claim: Option<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::LastClaim(recipient, asset));

        match last_claim {
            None => (true, 0),
            Some(last_seq) => {
                let elapsed = current_ledger.saturating_sub(last_seq);
                if elapsed >= config.cooldown_ledgers {
                    (true, 0)
                } else {
                    (false, config.cooldown_ledgers - elapsed)
                }
            }
        }
    }

    /// Claim a single test asset (Token A or Token B)
    pub fn request_tokens(env: Env, recipient: Address, asset: Address) {
        recipient.require_auth();

        let config: AssetConfig = env
            .storage()
            .persistent()
            .get::<DataKey, AssetConfig>(&DataKey::Asset(asset.clone()))
            .unwrap_or_else(|| panic!("asset not allowed on faucet"));

        if !config.enabled {
            panic!("asset is currently disabled");
        }

        let current_ledger = env.ledger().sequence();
        let last_claim_key = DataKey::LastClaim(recipient.clone(), asset.clone());
        let last_claim: Option<u32> = env.storage().persistent().get(&last_claim_key);

        if let Some(last_seq) = last_claim {
            let elapsed = current_ledger.saturating_sub(last_seq);
            if elapsed < config.cooldown_ledgers {
                panic!("faucet cooldown active");
            }
        }

        // Save ledger sequence for rate limiting
        env.storage().persistent().set(&last_claim_key, &current_ledger);

        // Atomic token transfer or mint fallback
        let token_client = TokenClient::new(&env, &asset);
        let contract_balance = token_client.balance(&env.current_contract_address());

        if contract_balance >= config.claim_amount {
            token_client.transfer(&env.current_contract_address(), &recipient, &config.claim_amount);
        } else {
            let stellar_client = StellarAssetClient::new(&env, &asset);
            stellar_client.mint(&recipient, &config.claim_amount);
        }

        // Publish event
        env.events().publish(
            (symbol_short!("faucet"), symbol_short!("claim"), asset),
            (recipient, config.claim_amount, current_ledger),
        );

        bump_instance(&env);
    }

    /// Claim multiple test assets (e.g. Token A & Token B) in a single atomic transaction
    pub fn batch_claim(env: Env, recipient: Address, assets: Vec<Address>) {
        recipient.require_auth();

        for asset in assets.iter() {
            let config: AssetConfig = match env.storage().persistent().get::<DataKey, AssetConfig>(&DataKey::Asset(asset.clone())) {
                Some(cfg) if cfg.enabled => cfg,
                _ => continue,
            };

            let current_ledger = env.ledger().sequence();
            let last_claim_key = DataKey::LastClaim(recipient.clone(), asset.clone());
            let last_claim: Option<u32> = env.storage().persistent().get(&last_claim_key);

            if let Some(last_seq) = last_claim {
                let elapsed = current_ledger.saturating_sub(last_seq);
                if elapsed < config.cooldown_ledgers {
                    continue;
                }
            }

            env.storage().persistent().set(&last_claim_key, &current_ledger);

            let token_client = TokenClient::new(&env, &asset);
            let contract_balance = token_client.balance(&env.current_contract_address());

            if contract_balance >= config.claim_amount {
                token_client.transfer(&env.current_contract_address(), &recipient, &config.claim_amount);
            } else {
                let stellar_client = StellarAssetClient::new(&env, &asset);
                stellar_client.mint(&recipient, &config.claim_amount);
            }

            env.events().publish(
                (symbol_short!("faucet"), symbol_short!("claim"), asset),
                (recipient.clone(), config.claim_amount, current_ledger),
            );
        }

        bump_instance(&env);
    }
}
```

---

## 3. Step-by-Step Testnet Walkthrough & CLI Execution

### Step 1: Environment Setup & Key Generation
```bash
# Configure CLI network to Stellar Testnet
stellar network use testnet

# Generate 3 dedicated keypairs
stellar keys generate deployer
stellar keys generate alice
stellar keys generate bob

# Fund keypairs via Stellar Friendbot
stellar keys fund deployer
stellar keys fund alice
stellar keys fund bob
```

### Step 2: Build & Deploy Demo Tokens (Token A & Token B)
```bash
# Build Wasm binaries
stellar contract build --package token-a
stellar contract build --package token-b

# Deploy Token A (USDC)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/token_a.wasm \
  --source deployer \
  --alias token-a

# Deploy Token B (XYZ Collateral)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/token_b.wasm \
  --source deployer \
  --alias token-b
```

### Step 3: Deploy & Initialize Faucet Contract
```bash
# Deploy Faucet Contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/nexus_faucet_contract.wasm \
  --source deployer \
  --alias faucet

# Initialize Faucet Contract with Deployer Admin
stellar contract invoke \
  --id faucet \
  --source deployer \
  -- initialize \
  --admin deployer

# Configure Token A (100 USDC per claim, 100 ledgers cooldown)
stellar contract invoke \
  --id faucet \
  --source deployer \
  -- set_asset_config \
  --asset token-a \
  --claim_amount 1000000000 \
  --cooldown_ledgers 100 \
  --enabled true

# Configure Token B (50 XYZ per claim, 100 ledgers cooldown)
stellar contract invoke \
  --id faucet \
  --source deployer \
  -- set_asset_config \
  --asset token-b \
  --claim_amount 500000000 \
  --cooldown_ledgers 100 \
  --enabled true
```

### Step 4: Claim Tokens via Faucet
```bash
# Alice claims Token A (USDC)
stellar contract invoke \
  --id faucet \
  --source alice \
  -- request_tokens \
  --recipient alice \
  --asset token-a

# Bob claims Token B (XYZ)
stellar contract invoke \
  --id faucet \
  --source bob \
  -- request_tokens \
  --recipient bob \
  --asset token-b

# Alternatively: Alice performs Batch Claim for both tokens in 1 transaction
stellar contract invoke \
  --id faucet \
  --source alice \
  -- batch_claim \
  --recipient alice \
  --assets '["token-a", "token-b"]'
```

---

## 4. Escrow Swap Mechanics (`make`, `take`, `refund`)

```
               ┌────────────────────────────────────────┐
               │         Escrow Swap State Machine      │
               └────────────────────────────────────────┘

 [Alice: 10 Token A] ─── make(10 A -> 10 B) ───► [Escrow: 10 A Locked (Offer #0)]
                                                         │
               ┌─────────────────────────────────────────┴─────────────────────────────────────────┐
               │                                                                                   │
      Bob calls take()                                                                  Alice calls refund()
               │                                                                                   │
               ▼                                                                                   ▼
  [Escrow sends 10 A -> Bob]                                                       [Escrow returns 10 A -> Alice]
  [Bob sends 10 B -> Alice]                                                        [Offer #0 DELETED from state]
  [Offer #0 DELETED from state]
```

### Atomic Guarantee in Soroban
If Bob executes `take()`, Soroban executes all internal balance transfers inside a single deterministic transaction frame. If Bob lacks sufficient Token B, the transaction fails completely and rolls back: **no funds are ever stuck in partial states.**
