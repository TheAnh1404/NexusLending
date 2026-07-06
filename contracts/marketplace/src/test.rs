extern crate std;

use super::*;
use nexus_contracts_shared::{LoanStatus, OfferStatus};
use nexus_loan_manager_contract::{LoanManagerContract, LoanManagerContractClient};
use nexus_oracle_contract::OracleContract;
use nexus_vault_contract::{VaultContract, VaultContractClient};
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env};
use std::boxed::Box;

struct Fixture<'a> {
    lender: Address,
    borrower: Address,
    loan_asset: Address,
    collateral_asset: Address,
    marketplace: MarketplaceContractClient<'a>,
    loan_manager: LoanManagerContractClient<'a>,
    vault: VaultContractClient<'a>,
    loan_token: StellarAssetClient<'a>,
}

fn setup() -> Fixture<'static> {
    let env = Box::leak(Box::new(Env::default()));
    env.mock_all_auths_allowing_non_root_auth();

    let admin = Address::generate(env);
    let lender = Address::generate(env);
    let borrower = Address::generate(env);
    let loan_asset = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let collateral_asset = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let loan_token = StellarAssetClient::new(env, &loan_asset);
    loan_token.mint(&lender, &1_000);

    let oracle_id = env.register(OracleContract, ());
    let vault_id = env.register(VaultContract, ());
    let loan_manager_id = env.register(LoanManagerContract, ());
    let marketplace_id = env.register(MarketplaceContract, ());

    let vault = VaultContractClient::new(env, &vault_id);
    let loan_manager = LoanManagerContractClient::new(env, &loan_manager_id);
    let marketplace = MarketplaceContractClient::new(env, &marketplace_id);

    vault.initialize(&admin, &marketplace_id, &loan_manager_id);
    loan_manager.initialize(&admin, &vault_id, &oracle_id);
    marketplace.initialize(&admin, &vault_id, &loan_manager_id);

    Fixture {
        lender,
        borrower,
        loan_asset,
        collateral_asset,
        marketplace,
        loan_manager,
        vault,
        loan_token,
    }
}

fn create_offer_record(f: &Fixture) -> u64 {
    f.marketplace.create_offer(
        &f.lender,
        &f.loan_asset,
        &100,
        &1_000,
        &30,
        &f.collateral_asset,
        &6_000,
        &8_000,
        &500,
        &3,
        &0,
    )
}

fn fund_and_activate(f: &Fixture, offer_id: u64) {
    f.marketplace.fund_offer(&offer_id);
    f.marketplace.activate_offer(&offer_id);
}

#[test]
fn create_offer() {
    let f = setup();

    let offer_id = create_offer_record(&f);
    let offer = f.marketplace.get_offer(&offer_id);

    assert_eq!(offer.status, OfferStatus::Draft);
    assert_eq!(offer.loan_amount, 100);
    assert_eq!(offer.min_health_factor_bps, 14_000);
    assert_eq!(f.marketplace.get_offer_count(), 1);
    assert_eq!(f.loan_token.balance(&f.lender), 1_000);
}

#[test]
fn fund_offer() {
    let f = setup();
    let offer_id = create_offer_record(&f);

    f.marketplace.fund_offer(&offer_id);

    assert_eq!(f.marketplace.get_offer(&offer_id).status, OfferStatus::Funding);
    assert_eq!(f.vault.get_offer_locked_amount(&offer_id), 100);
    assert_eq!(f.loan_token.balance(&f.lender), 900);
}

#[test]
fn active_offer_after_funding() {
    let f = setup();
    let offer_id = create_offer_record(&f);

    fund_and_activate(&f, offer_id);

    assert_eq!(f.marketplace.get_offer(&offer_id).status, OfferStatus::Active);
}

#[test]
fn cancel_active_offer_before_matched() {
    let f = setup();
    let offer_id = create_offer_record(&f);
    fund_and_activate(&f, offer_id);

    f.marketplace.cancel_offer(&offer_id);

    assert_eq!(f.marketplace.get_offer(&offer_id).status, OfferStatus::Cancelled);
    assert_eq!(f.vault.get_offer_locked_amount(&offer_id), 0);
    assert_eq!(f.loan_token.balance(&f.lender), 1_000);
}

#[test]
fn cannot_accept_non_active_offer() {
    let f = setup();
    let offer_id = create_offer_record(&f);

    let result = f
        .marketplace
        .try_accept_offer(&offer_id, &f.borrower, &20);

    assert!(result.is_err());
}

#[test]
fn accept_active_offer() {
    let f = setup();
    let offer_id = create_offer_record(&f);
    fund_and_activate(&f, offer_id);

    let loan_id = f
        .marketplace
        .accept_offer(&offer_id, &f.borrower, &20);
    let offer = f.marketplace.get_offer(&offer_id);
    let loan = f.loan_manager.get_loan(&loan_id);

    assert_eq!(offer.status, OfferStatus::Matched);
    assert_eq!(loan.status, LoanStatus::PendingCollateral);
    assert_eq!(loan.collateral_amount, 20);
}

#[test]
fn cannot_accept_same_offer_twice() {
    let f = setup();
    let offer_id = create_offer_record(&f);
    fund_and_activate(&f, offer_id);

    f.marketplace.accept_offer(&offer_id, &f.borrower, &20);
    let result = f
        .marketplace
        .try_accept_offer(&offer_id, &f.borrower, &20);

    assert!(result.is_err());
}

#[test]
fn expired_offer_cannot_be_accepted() {
    let f = setup();
    let offer_id = create_offer_record(&f);
    fund_and_activate(&f, offer_id);

    f.marketplace.expire_offer(&offer_id);
    let result = f
        .marketplace
        .try_accept_offer(&offer_id, &f.borrower, &20);

    assert!(result.is_err());
    assert_eq!(f.marketplace.get_offer(&offer_id).status, OfferStatus::Expired);
}
