extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env};
use std::boxed::Box;

struct Fixture<'a> {
    lender: Address,
    borrower: Address,
    liquidator: Address,
    asset: Address,
    vault_id: Address,
    vault: VaultContractClient<'a>,
    token: StellarAssetClient<'a>,
}

fn setup() -> Fixture<'static> {
    let env = Box::leak(Box::new(Env::default()));
    env.mock_all_auths_allowing_non_root_auth();

    let admin = Address::generate(env);
    let marketplace = Address::generate(env);
    let loan_manager = Address::generate(env);
    let lender = Address::generate(env);
    let borrower = Address::generate(env);
    let liquidator = Address::generate(env);
    let asset = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token = StellarAssetClient::new(env, &asset);
    token.mint(&lender, &1_000);
    token.mint(&borrower, &1_000);

    let vault_id = env.register(VaultContract, ());
    let vault = VaultContractClient::new(env, &vault_id);
    vault.initialize(&admin, &marketplace, &loan_manager);

    Fixture {
        lender,
        borrower,
        liquidator,
        asset,
        vault_id,
        vault,
        token,
    }
}

#[test]
fn lock_lender_funds() {
    let f = setup();

    f.vault
        .lock_lender_funds(&1, &f.lender, &f.asset, &100);

    assert_eq!(f.vault.get_offer_locked_amount(&1), 100);
    assert_eq!(f.token.balance(&f.lender), 900);
    assert_eq!(f.token.balance(&f.vault_id), 100);
}

#[test]
fn unlock_lender_funds() {
    let f = setup();

    f.vault
        .lock_lender_funds(&1, &f.lender, &f.asset, &100);
    f.vault
        .unlock_lender_funds(&1, &f.lender, &f.asset, &100);

    assert_eq!(f.vault.get_offer_locked_amount(&1), 0);
    assert_eq!(f.token.balance(&f.lender), 1_000);
}

#[test]
fn reject_unauthorized_caller() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let marketplace = Address::generate(&env);
    let loan_manager = Address::generate(&env);
    let lender = Address::generate(&env);
    let asset = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let vault_id = env.register(VaultContract, ());
    let vault = VaultContractClient::new(&env, &vault_id);
    vault.initialize(&admin, &marketplace, &loan_manager);

    let result = vault.try_lock_lender_funds(&1, &lender, &asset, &100);
    assert!(result.is_err());
}

#[test]
fn lock_borrower_collateral() {
    let f = setup();

    f.vault
        .lock_borrower_collateral(&1, &f.borrower, &f.asset, &200);

    assert_eq!(f.vault.get_loan_collateral_amount(&1), 200);
    assert_eq!(f.vault.get_locked(&1, &f.asset), 200);
    assert_eq!(f.token.balance(&f.borrower), 800);
}

#[test]
fn release_borrower_collateral() {
    let f = setup();

    f.vault
        .lock_borrower_collateral(&1, &f.borrower, &f.asset, &200);
    f.vault
        .release_borrower_collateral(&1, &f.borrower, &f.asset, &75);

    assert_eq!(f.vault.get_loan_collateral_amount(&1), 125);
    assert_eq!(f.token.balance(&f.borrower), 875);
}

#[test]
fn transfer_loan_asset_to_borrower() {
    let f = setup();

    f.vault
        .lock_lender_funds(&1, &f.lender, &f.asset, &100);
    f.vault
        .transfer_loan_asset_to_borrower(&1, &1, &f.borrower, &f.asset, &100);

    assert_eq!(f.vault.get_offer_locked_amount(&1), 0);
    assert_eq!(f.token.balance(&f.borrower), 1_100);
}

#[test]
fn transfer_repayment_to_lender() {
    let f = setup();
    f.token.mint(&f.vault_id, &100);

    f.vault
        .transfer_repayment_to_lender(&1, &f.lender, &f.asset, &100);

    assert_eq!(f.token.balance(&f.lender), 1_100);
}

#[test]
fn transfer_collateral_to_liquidator() {
    let f = setup();

    f.vault
        .lock_borrower_collateral(&1, &f.borrower, &f.asset, &200);
    f.vault
        .transfer_collateral_to_liq(&1, &f.liquidator, &f.asset, &50);

    assert_eq!(f.vault.get_loan_collateral_amount(&1), 150);
    assert_eq!(f.token.balance(&f.liquidator), 50);
}
