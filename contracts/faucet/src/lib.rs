#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

#[cfg(test)]
mod test;

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
    LastClaim(Address, Address), // (recipient, asset) -> ledger_number
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
    /// Initialize Faucet contract with admin control
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("faucet already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        bump_instance(&env);
    }

    /// Admin update function
    pub fn set_admin(env: Env, new_admin: Address) {
        require_admin(&env);
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        bump_instance(&env);
    }

    /// Query current contract admin
    pub fn get_admin(env: Env) -> Address {
        get_admin(&env)
    }

    /// Admin configures asset claim amount & cooldown rule
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

    /// Query configuration for an asset
    pub fn get_asset_config(env: Env, asset: Address) -> Option<AssetConfig> {
        env.storage().persistent().get(&DataKey::Asset(asset))
    }

    /// Check if a recipient is eligible to claim an asset and remaining cooldown ledgers
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

    /// Claim test tokens for lending & borrowing testing on Stellar Testnet
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
        let last_claim: Option<u32> = env
            .storage()
            .persistent()
            .get(&last_claim_key);

        if let Some(last_seq) = last_claim {
            let elapsed = current_ledger.saturating_sub(last_seq);
            if elapsed < config.cooldown_ledgers {
                panic!("faucet cooldown active");
            }
        }

        // Record current claim ledger sequence
        env.storage().persistent().set(&last_claim_key, &current_ledger);

        // Perform token transfer or mint to recipient
        let token_client = TokenClient::new(&env, &asset);
        let contract_balance = token_client.balance(&env.current_contract_address());

        if contract_balance >= config.claim_amount {
            token_client.transfer(&env.current_contract_address(), &recipient, &config.claim_amount);
        } else {
            // Attempt owner-restricted mint if faucet is authorized minter
            let stellar_client = StellarAssetClient::new(&env, &asset);
            stellar_client.mint(&recipient, &config.claim_amount);
        }

        // Emit Soroban event
        env.events().publish(
            (symbol_short!("faucet"), symbol_short!("claim"), asset),
            (recipient, config.claim_amount, current_ledger),
        );

        bump_instance(&env);
    }
}
