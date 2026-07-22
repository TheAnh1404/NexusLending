extern crate std;

use super::*;
use nexus_oracle_contract::{OracleContract, OracleContractClient};
use nexus_vault_contract::{VaultContract, VaultContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Env, String,
};
use std::boxed::Box;

struct Fixture<'a> {
    env: &'a Env,
    lender: Address,
    borrower: Address,
    liquidator: Address,
    loan_asset: Address,
    collateral_asset: Address,
    loan_manager: LoanManagerContractClient<'a>,
    oracle: OracleContractClient<'a>,
    vault: VaultContractClient<'a>,
    loan_token: StellarAssetClient<'a>,
    collateral_token: StellarAssetClient<'a>,
}

fn setup() -> Fixture<'static> {
    let env = Box::leak(Box::new(Env::default()));
    env.mock_all_auths_allowing_non_root_auth();

    let admin = Address::generate(env);
    let marketplace = Address::generate(env);
    let lender = Address::generate(env);
    let borrower = Address::generate(env);
    let liquidator = Address::generate(env);

    let loan_asset = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let collateral_asset = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let loan_token = StellarAssetClient::new(env, &loan_asset);
    let collateral_token = StellarAssetClient::new(env, &collateral_asset);
    loan_token.mint(&lender, &10_000);
    loan_token.mint(&borrower, &10_000);
    loan_token.mint(&liquidator, &10_000);
    collateral_token.mint(&borrower, &10_000);

    let oracle_id = env.register(OracleContract, ());
    let vault_id = env.register(VaultContract, ());
    let loan_manager_id = env.register(LoanManagerContract, ());

    let oracle = OracleContractClient::new(env, &oracle_id);
    let vault = VaultContractClient::new(env, &vault_id);
    let loan_manager = LoanManagerContractClient::new(env, &loan_manager_id);

    oracle.initialize(&admin);
    vault.initialize(&admin, &marketplace, &loan_manager_id);
    loan_manager.initialize(&admin, &marketplace, &vault_id, &oracle_id);
    set_collateral_price_raw(env, &oracle, &collateral_asset, &loan_asset, 10, 0);

    Fixture {
        env,
        lender,
        borrower,
        liquidator,
        loan_asset,
        collateral_asset,
        loan_manager,
        oracle,
        vault,
        loan_token,
        collateral_token,
    }
}

fn offer(f: &Fixture) -> LoanOffer {
    LoanOffer {
        offer_id: 1,
        lender: f.lender.clone(),
        loan_asset: f.loan_asset.clone(),
        loan_amount: 100,
        fixed_apr_bps: 1_825,
        duration_days: 20,
        collateral_asset: f.collateral_asset.clone(),
        max_ltv_bps: 7_000,
        liquidation_threshold_bps: 8_000,
        liquidation_bonus_bps: 500,
        grace_period_days: 3,
        min_health_factor_bps: 14_000,
        status: OfferStatus::Active,
    }
}

fn create_pending(f: &Fixture, collateral_amount: i128) -> u64 {
    f.loan_manager
        .create_pending_loan_from_offer(&offer(f), &f.borrower, &collateral_amount)
}

fn fund_offer(f: &Fixture) {
    f.vault
        .lock_lender_funds(&1, &f.lender, &f.loan_asset, &100);
}

fn activate_loan(f: &Fixture) -> u64 {
    fund_offer(f);
    let loan_id = create_pending(f, 20);
    f.loan_manager.activate_loan(&loan_id);
    loan_id
}

fn set_collateral_price(f: &Fixture, price: i128) {
    set_collateral_price_raw(
        f.env,
        &f.oracle,
        &f.collateral_asset,
        &f.loan_asset,
        price,
        0,
    );
}

fn set_collateral_price_raw(
    env: &Env,
    oracle: &OracleContractClient,
    collateral_asset: &Address,
    loan_asset: &Address,
    price: i128,
    decimals: u32,
) {
    oracle.set_price_for_assets(
        collateral_asset,
        loan_asset,
        &String::from_str(env, "XLM/USDC"),
        &price,
        &decimals,
        &String::from_str(env, "test"),
    );
}

#[test]
fn create_pending_loan() {
    let f = setup();

    let loan_id = create_pending(&f, 20);
    let loan = f.loan_manager.get_loan(&loan_id);

    assert_eq!(loan.status, LoanStatus::PendingCollateral);
    assert_eq!(loan.outstanding_debt, 101);
    assert_eq!(loan.collateral_amount, 20);
    assert_eq!(f.loan_manager.get_loan_count(), 1);
}

#[test]
fn direct_pending_loan_creation_requires_marketplace_auth() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let marketplace = Address::generate(&env);
    let vault = Address::generate(&env);
    let oracle = Address::generate(&env);
    let lender = Address::generate(&env);
    let borrower = Address::generate(&env);
    let loan_asset = Address::generate(&env);
    let collateral_asset = Address::generate(&env);
    let loan_manager_id = env.register(LoanManagerContract, ());
    let loan_manager = LoanManagerContractClient::new(&env, &loan_manager_id);
    loan_manager.initialize(&admin, &marketplace, &vault, &oracle);

    let forged_offer = LoanOffer {
        offer_id: 1,
        lender,
        loan_asset,
        loan_amount: 100,
        fixed_apr_bps: 1_825,
        duration_days: 20,
        collateral_asset,
        max_ltv_bps: 7_000,
        liquidation_threshold_bps: 8_000,
        liquidation_bonus_bps: 500,
        grace_period_days: 3,
        min_health_factor_bps: 14_000,
        status: OfferStatus::Active,
    };

    let result = loan_manager.try_create_pending_loan_from_offer(&forged_offer, &borrower, &20);

    assert!(result.is_err());
    assert_eq!(loan_manager.get_loan_count(), 0);
}

#[test]
fn rejects_offer_apr_above_twenty_percent() {
    let f = setup();
    let mut offer = offer(&f);
    offer.fixed_apr_bps = 2_001;

    let result = f
        .loan_manager
        .try_create_pending_loan_from_offer(&offer, &f.borrower, &20);

    assert!(result.is_err());
}

#[test]
fn activate_loan_if_hf_safe() {
    let f = setup();

    let loan_id = activate_loan(&f);
    let loan = f.loan_manager.get_loan(&loan_id);

    assert_eq!(loan.status, LoanStatus::Active);
    assert_eq!(f.vault.get_loan_collateral_amount(&loan_id), 20);
    assert_eq!(f.vault.get_offer_locked_amount(&1), 0);
    assert_eq!(f.loan_token.balance(&f.borrower), 10_100);
}

#[test]
fn reject_activation_if_hf_below_minimum() {
    let f = setup();
    fund_offer(&f);
    let loan_id = create_pending(&f, 10);

    let result = f.loan_manager.try_activate_loan(&loan_id);

    assert!(result.is_err());
    assert_eq!(
        f.loan_manager.get_loan(&loan_id).status,
        LoanStatus::PendingCollateral
    );
}

#[test]
fn calculate_ltv() {
    let f = setup();
    let loan_id = create_pending(&f, 20);

    assert_eq!(f.loan_manager.calculate_ltv(&loan_id), 5_050);
}

#[test]
fn calculate_health_factor() {
    let f = setup();
    let loan_id = create_pending(&f, 20);

    assert_eq!(f.loan_manager.calculate_health_factor(&loan_id), 15_841);
}

#[test]
fn stale_oracle_price_blocks_risk_calculation() {
    let f = setup();
    let loan_id = create_pending(&f, 20);
    f.env.ledger().set_timestamp(SECONDS_PER_DAY + 1);

    let result = f.loan_manager.try_calculate_health_factor(&loan_id);

    assert!(result.is_err());
}

#[test]
fn price_drop_changes_hf() {
    let f = setup();
    let loan_id = create_pending(&f, 20);
    let before = f.loan_manager.calculate_health_factor(&loan_id);

    set_collateral_price(&f, 7);
    let after = f.loan_manager.calculate_health_factor(&loan_id);

    assert!(after < before);
    assert_eq!(after, 11_089);
}

#[test]
fn refresh_state_safe_to_warning() {
    let f = setup();
    let loan_id = activate_loan(&f);

    set_collateral_price(&f, 8);

    assert_eq!(
        f.loan_manager.refresh_loan_state(&loan_id),
        LoanStatus::Warning
    );
}

#[test]
fn refresh_state_warning_to_liquidation_planning() {
    let f = setup();
    let loan_id = activate_loan(&f);

    set_collateral_price(&f, 8);
    f.loan_manager.refresh_loan_state(&loan_id);
    set_collateral_price(&f, 7);

    assert_eq!(
        f.loan_manager.refresh_loan_state(&loan_id),
        LoanStatus::LiquidationPlanning
    );
}

#[test]
fn add_collateral_improves_hf() {
    let f = setup();
    let loan_id = activate_loan(&f);
    set_collateral_price(&f, 7);
    f.loan_manager.refresh_loan_state(&loan_id);
    let before = f.loan_manager.calculate_health_factor(&loan_id);

    f.loan_manager.add_collateral(&loan_id, &10);
    let after = f.loan_manager.calculate_health_factor(&loan_id);

    assert!(after > before);
    assert_eq!(f.loan_manager.get_loan(&loan_id).status, LoanStatus::Active);
}

#[test]
fn partial_repay_improves_hf() {
    let f = setup();
    let loan_id = activate_loan(&f);
    set_collateral_price(&f, 7);
    f.loan_manager.refresh_loan_state(&loan_id);
    let before = f.loan_manager.calculate_health_factor(&loan_id);

    f.loan_manager.partial_repay(&loan_id, &30);
    let after = f.loan_manager.calculate_health_factor(&loan_id);

    assert!(after > before);
    assert_eq!(f.loan_manager.get_loan(&loan_id).status, LoanStatus::Active);
}

#[test]
fn full_repay_closes_loan() {
    let f = setup();
    let loan_id = activate_loan(&f);

    f.loan_manager.full_repay(&loan_id);
    let loan = f.loan_manager.get_loan(&loan_id);

    assert_eq!(loan.status, LoanStatus::Repaid);
    assert_eq!(loan.outstanding_debt, 0);
    assert_eq!(loan.collateral_amount, 0);
    assert_eq!(f.vault.get_loan_collateral_amount(&loan_id), 0);
}

#[test]
fn cleanup_repaid_loan_removes_storage() {
    let f = setup();
    let loan_id = activate_loan(&f);

    f.loan_manager.full_repay(&loan_id);
    f.loan_manager.cleanup_loan(&loan_id);

    assert!(f.loan_manager.try_get_loan(&loan_id).is_err());
}

#[test]
fn liquidation_only_allowed_when_hf_below_threshold() {
    let f = setup();
    let loan_id = activate_loan(&f);

    let result = f.loan_manager.try_liquidate(&loan_id, &f.liquidator, &50);

    assert!(result.is_err());
}

#[test]
fn partial_liquidation_reduces_debt_and_collateral() {
    let f = setup();
    let loan_id = activate_loan(&f);
    set_collateral_price(&f, 7);
    f.loan_manager.refresh_loan_state(&loan_id);
    let liquidator_collateral_before = f.collateral_token.balance(&f.liquidator);

    f.loan_manager.liquidate(&loan_id, &f.liquidator, &80);
    let loan = f.loan_manager.get_loan(&loan_id);

    assert_eq!(loan.outstanding_debt, 51);
    assert!(loan.collateral_amount < 20);
    assert!(f.collateral_token.balance(&f.liquidator) > liquidator_collateral_before);
}

#[test]
fn defaulted_loan_can_be_liquidated() {
    let f = setup();
    let loan_id = activate_loan(&f);
    let loan = f.loan_manager.get_loan(&loan_id);
    f.env
        .ledger()
        .set_timestamp(loan.due_time + (loan.grace_period_days as u64 * SECONDS_PER_DAY) + 1);

    f.loan_manager.mark_defaulted(&loan_id);
    set_collateral_price(&f, 10);
    f.loan_manager.liquidate(&loan_id, &f.liquidator, &50);

    let loan = f.loan_manager.get_loan(&loan_id);
    assert_eq!(loan.status, LoanStatus::Defaulted);
    assert!(loan.outstanding_debt < 101);
}

#[test]
fn defaulted_liquidation_requires_fresh_oracle_price() {
    let f = setup();
    let loan_id = activate_loan(&f);
    let loan = f.loan_manager.get_loan(&loan_id);
    f.env
        .ledger()
        .set_timestamp(loan.due_time + (loan.grace_period_days as u64 * SECONDS_PER_DAY) + 1);

    f.loan_manager.mark_defaulted(&loan_id);
    let result = f.loan_manager.try_liquidate(&loan_id, &f.liquidator, &50);

    assert!(result.is_err());
}
