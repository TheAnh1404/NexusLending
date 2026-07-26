#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{StellarAssetClient, TokenClient},
    Address, Env,
};

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (TokenClient<'a>, StellarAssetClient<'a>) {
    let contract_id = env.register_stellar_asset_contract_v2(admin.clone());
    (
        TokenClient::new(env, &contract_id.address()),
        StellarAssetClient::new(env, &contract_id.address()),
    )
}

fn create_faucet_contract<'a>(env: &Env, admin: &Address) -> FaucetContractClient<'a> {
    let contract_id = env.register(FaucetContract, ());
    let client = FaucetContractClient::new(env, &contract_id);
    client.initialize(admin);
    client
}

#[test]
fn test_faucet_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let faucet = create_faucet_contract(&env, &admin);

    assert_eq!(faucet.get_admin(), admin);
}

#[test]
fn test_set_and_get_asset_config() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let faucet = create_faucet_contract(&env, &admin);

    let (token_client, _) = create_token_contract(&env, &admin);
    let token_address = token_client.address;

    faucet.set_asset_config(&token_address, &1_000_0000000, &100, &true);

    let config = faucet.get_asset_config(&token_address).unwrap();
    assert_eq!(config.claim_amount, 1_000_0000000);
    assert_eq!(config.cooldown_ledgers, 100);
    assert!(config.enabled);
}

#[test]
fn test_request_tokens_mint_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let faucet = create_faucet_contract(&env, &admin);
    let recipient = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_client.address.clone();

    // Set faucet as token admin/minter or transfer initial balance to faucet
    token_admin.mint(&faucet.address, &10_000_0000000);

    faucet.set_asset_config(&token_address, &1_000_0000000, &100, &true);

    // Initial eligibility check
    let (eligible, cooldown) = faucet.get_eligibility(&recipient, &token_address);
    assert!(eligible);
    assert_eq!(cooldown, 0);

    // Request tokens
    faucet.request_tokens(&recipient, &token_address);

    assert_eq!(token_client.balance(&recipient), 1_000_0000000);

    // Immediately after request, cooldown is active
    let (eligible_after, cooldown_after) = faucet.get_eligibility(&recipient, &token_address);
    assert!(!eligible_after);
    assert_eq!(cooldown_after, 100);
}

#[test]
#[should_panic(expected = "faucet cooldown active")]
fn test_cooldown_enforcement() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let faucet = create_faucet_contract(&env, &admin);
    let recipient = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_client.address.clone();

    token_admin.mint(&faucet.address, &10_000_0000000);
    faucet.set_asset_config(&token_address, &1_000_0000000, &100, &true);

    // First request succeeds
    faucet.request_tokens(&recipient, &token_address);

    // Second request within same ledger panics with cooldown active
    faucet.request_tokens(&recipient, &token_address);
}

#[test]
fn test_request_after_cooldown_expiry() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let faucet = create_faucet_contract(&env, &admin);
    let recipient = Address::generate(&env);

    let (token_client, token_admin) = create_token_contract(&env, &admin);
    let token_address = token_client.address.clone();

    token_admin.mint(&faucet.address, &10_000_0000000);
    faucet.set_asset_config(&token_address, &1_000_0000000, &100, &true);

    // First claim
    faucet.request_tokens(&recipient, &token_address);
    assert_eq!(token_client.balance(&recipient), 1_000_0000000);

    // Advance ledger sequence past cooldown (101 ledgers)
    env.ledger().set_sequence_number(102);

    let (eligible, _) = faucet.get_eligibility(&recipient, &token_address);
    assert!(eligible);

    // Second claim succeeds after cooldown
    faucet.request_tokens(&recipient, &token_address);
    assert_eq!(token_client.balance(&recipient), 2_000_0000000);
}

#[test]
fn test_batch_claim_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let faucet = create_faucet_contract(&env, &admin);
    let recipient = Address::generate(&env);

    let (token_a, token_a_admin) = create_token_contract(&env, &admin);
    let (token_b, token_b_admin) = create_token_contract(&env, &admin);

    token_a_admin.mint(&faucet.address, &10_000_0000000);
    token_b_admin.mint(&faucet.address, &10_000_0000000);

    faucet.set_asset_config(&token_a.address, &1_000_0000000, &100, &true);
    faucet.set_asset_config(&token_b.address, &500_0000000, &100, &true);

    let mut assets = soroban_sdk::Vec::new(&env);
    assets.push_back(token_a.address.clone());
    assets.push_back(token_b.address.clone());

    faucet.batch_claim(&recipient, &assets);

    assert_eq!(token_a.balance(&recipient), 1_000_0000000);
    assert_eq!(token_b.balance(&recipient), 500_0000000);
}
