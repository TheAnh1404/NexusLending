#![no_std]
#![allow(deprecated)]

use nexus_contracts_shared::{
    Loan, LoanOffer, LoanStatus, OfferStatus, PriceData, BPS_DENOMINATOR, CLOSE_FACTOR_BPS,
    LIQUIDATION_HEALTH_FACTOR_BPS, MAX_FIXED_APR_BPS, SAFE_HEALTH_FACTOR_BPS,
};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, IntoVal, Symbol, Val, Vec};

#[cfg(test)]
mod test;

const SECONDS_PER_DAY: u64 = 86_400;

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Vault,
    Oracle,
    LoanCount,
    Loan(u64),
}

#[contract]
pub struct LoanManagerContract;

#[contractimpl]
impl LoanManagerContract {
    pub fn initialize(env: Env, admin: Address, vault_contract: Address, oracle_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("loan manager already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Vault, &vault_contract);
        env.storage()
            .instance()
            .set(&DataKey::Oracle, &oracle_contract);
        env.storage().instance().set(&DataKey::LoanCount, &0_u64);
    }

    pub fn create_pending_loan_from_offer(
        env: Env,
        offer: LoanOffer,
        borrower: Address,
        collateral_amount: i128,
    ) -> u64 {
        require_positive(collateral_amount);
        if offer.status != OfferStatus::Active {
            panic!("offer is not active");
        }
        if offer.loan_amount <= 0 {
            panic!("loan amount must be positive");
        }
        if offer.fixed_apr_bps == 0 || offer.fixed_apr_bps > MAX_FIXED_APR_BPS {
            panic!("fixed apr must be between 1 and 2000 bps");
        }

        let loan_id = next_loan_id(&env);
        let outstanding_debt =
            principal_with_interest(offer.loan_amount, offer.fixed_apr_bps, offer.duration_days);

        let loan = Loan {
            loan_id,
            offer_id: offer.offer_id,
            lender: offer.lender.clone(),
            borrower,
            loan_asset: offer.loan_asset.clone(),
            principal: offer.loan_amount,
            outstanding_debt,
            fixed_apr_bps: offer.fixed_apr_bps,
            duration_days: offer.duration_days,
            collateral_asset: offer.collateral_asset.clone(),
            collateral_amount,
            start_time: 0,
            due_time: 0,
            max_ltv_bps: offer.max_ltv_bps,
            liquidation_threshold_bps: offer.liquidation_threshold_bps,
            liquidation_bonus_bps: offer.liquidation_bonus_bps,
            min_health_factor_bps: max_u32(offer.min_health_factor_bps, SAFE_HEALTH_FACTOR_BPS),
            grace_period_days: offer.grace_period_days,
            status: LoanStatus::PendingCollateral,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events().publish(
            (Symbol::new(&env, "loan_created"), loan_id),
            loan.outstanding_debt,
        );
        loan_id
    }

    pub fn activate_loan(env: Env, loan_id: u64) {
        let mut loan = get_loan_or_panic(&env, loan_id);
        if loan.status != LoanStatus::PendingCollateral {
            panic!("loan is not pending collateral");
        }
        loan.borrower.require_auth();

        let ltv = calculate_ltv_for_loan(&env, &loan);
        if ltv > loan.max_ltv_bps {
            panic!("collateral below max ltv");
        }
        let hf = calculate_health_factor_for_loan(&env, &loan);
        if hf < effective_min_hf(&loan) {
            panic!("health factor below minimum");
        }

        call_vault_lock_collateral(
            &env,
            loan_id,
            &loan.borrower,
            &loan.collateral_asset,
            loan.collateral_amount,
        );
        call_vault_transfer_loan_asset(
            &env,
            loan.offer_id,
            loan_id,
            &loan.borrower,
            &loan.loan_asset,
            loan.principal,
        );

        let now = env.ledger().timestamp();
        loan.start_time = now;
        loan.due_time = checked_u64_add(
            now,
            checked_u64_mul(loan.duration_days as u64, SECONDS_PER_DAY),
        );
        loan.status = status_for_hf(&loan, hf);
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events().publish(
            (Symbol::new(&env, "loan_activated"), loan_id),
            loan.outstanding_debt,
        );
    }

    pub fn get_loan(env: Env, loan_id: u64) -> Loan {
        get_loan_or_panic(&env, loan_id)
    }

    pub fn get_loan_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::LoanCount)
            .unwrap_or(0_u64)
    }

    pub fn calculate_health_factor(env: Env, loan_id: u64) -> u32 {
        let loan = get_loan_or_panic(&env, loan_id);
        calculate_health_factor_for_loan(&env, &loan)
    }

    pub fn calculate_ltv(env: Env, loan_id: u64) -> u32 {
        let loan = get_loan_or_panic(&env, loan_id);
        calculate_ltv_for_loan(&env, &loan)
    }

    pub fn refresh_loan_state(env: Env, loan_id: u64) -> LoanStatus {
        let mut loan = get_loan_or_panic(&env, loan_id);
        update_status(&env, &mut loan);
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events().publish(
            (Symbol::new(&env, "loan_state_updated"), loan_id),
            loan.status.clone(),
        );
        loan.status
    }

    pub fn add_collateral(env: Env, loan_id: u64, amount: i128) {
        require_positive(amount);
        let mut loan = get_loan_or_panic(&env, loan_id);
        require_mutable(&loan);
        loan.borrower.require_auth();
        call_vault_lock_collateral(
            &env,
            loan_id,
            &loan.borrower,
            &loan.collateral_asset,
            amount,
        );
        loan.collateral_amount = checked_i128_add(loan.collateral_amount, amount);
        update_status(&env, &mut loan);
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events()
            .publish((Symbol::new(&env, "collateral_added"), loan_id), amount);
    }

    pub fn partial_repay(env: Env, loan_id: u64, amount: i128) {
        require_positive(amount);
        let mut loan = get_loan_or_panic(&env, loan_id);
        require_mutable(&loan);
        loan.borrower.require_auth();
        let repay_amount = min_i128(amount, loan.outstanding_debt);
        call_vault_collect_repayment(
            &env,
            loan_id,
            &loan.borrower,
            &loan.lender,
            &loan.loan_asset,
            repay_amount,
        );
        loan.outstanding_debt -= repay_amount;
        if loan.outstanding_debt == 0 {
            release_all_collateral(&env, &mut loan);
            loan.status = LoanStatus::Repaid;
        } else {
            update_status(&env, &mut loan);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events()
            .publish((Symbol::new(&env, "partial_repaid"), loan_id), repay_amount);
    }

    pub fn full_repay(env: Env, loan_id: u64) {
        let mut loan = get_loan_or_panic(&env, loan_id);
        require_mutable(&loan);
        loan.borrower.require_auth();
        let repay_amount = loan.outstanding_debt;
        if repay_amount > 0 {
            call_vault_collect_repayment(
                &env,
                loan_id,
                &loan.borrower,
                &loan.lender,
                &loan.loan_asset,
                repay_amount,
            );
        }
        loan.outstanding_debt = 0;
        release_all_collateral(&env, &mut loan);
        loan.status = LoanStatus::Repaid;
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events()
            .publish((Symbol::new(&env, "loan_repaid"), loan_id), repay_amount);
    }

    pub fn mark_expired(env: Env, loan_id: u64) {
        let mut loan = get_loan_or_panic(&env, loan_id);
        require_mutable(&loan);
        if env.ledger().timestamp() <= loan.due_time {
            panic!("loan not expired");
        }
        loan.status = LoanStatus::Expired;
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events()
            .publish((Symbol::new(&env, "loan_expired"), loan_id), loan.status);
    }

    pub fn mark_defaulted(env: Env, loan_id: u64) {
        let mut loan = get_loan_or_panic(&env, loan_id);
        require_mutable(&loan);
        let default_time = checked_u64_add(
            loan.due_time,
            checked_u64_mul(loan.grace_period_days as u64, SECONDS_PER_DAY),
        );
        if env.ledger().timestamp() <= default_time {
            panic!("loan still in grace period");
        }
        loan.status = LoanStatus::Defaulted;
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events()
            .publish((Symbol::new(&env, "loan_defaulted"), loan_id), loan.status);
    }

    pub fn liquidate(env: Env, loan_id: u64, liquidator: Address, repay_amount: i128) {
        require_positive(repay_amount);
        let mut loan = get_loan_or_panic(&env, loan_id);
        require_mutable(&loan);
        liquidator.require_auth();

        let hf = calculate_health_factor_for_loan(&env, &loan);
        if hf >= LIQUIDATION_HEALTH_FACTOR_BPS && loan.status != LoanStatus::Defaulted {
            panic!("loan is not liquidatable");
        }

        let max_repay = checked_u128_to_i128(
            checked_u128_mul(loan.outstanding_debt as u128, CLOSE_FACTOR_BPS as u128)
                / BPS_DENOMINATOR,
        );
        let repay = min_i128(repay_amount, min_i128(max_repay, loan.outstanding_debt));
        require_positive(repay);

        let seize_collateral = calculate_seize_collateral(&env, &loan, repay);
        if seize_collateral > loan.collateral_amount {
            panic!("insufficient collateral to seize");
        }

        call_vault_collect_repayment(
            &env,
            loan_id,
            &liquidator,
            &loan.lender,
            &loan.loan_asset,
            repay,
        );
        call_vault_transfer_collateral(
            &env,
            loan_id,
            &liquidator,
            &loan.collateral_asset,
            seize_collateral,
        );

        loan.outstanding_debt -= repay;
        loan.collateral_amount -= seize_collateral;
        if loan.outstanding_debt == 0 {
            loan.status = LoanStatus::Liquidated;
            if loan.collateral_amount > 0 {
                release_all_collateral(&env, &mut loan);
            }
        } else {
            update_status(&env, &mut loan);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Loan(loan_id), &loan);
        env.events().publish(
            (Symbol::new(&env, "loan_liquidated"), loan_id, liquidator),
            repay,
        );
    }
}

fn get_loan_or_panic(env: &Env, loan_id: u64) -> Loan {
    env.storage()
        .persistent()
        .get(&DataKey::Loan(loan_id))
        .unwrap_or_else(|| panic!("loan not found"))
}

fn next_loan_id(env: &Env) -> u64 {
    let current = env
        .storage()
        .instance()
        .get(&DataKey::LoanCount)
        .unwrap_or(0_u64);
    let next = checked_u64_add(current, 1);
    env.storage().instance().set(&DataKey::LoanCount, &next);
    next
}

fn require_mutable(loan: &Loan) {
    match loan.status {
        LoanStatus::Active
        | LoanStatus::Warning
        | LoanStatus::LiquidationPlanning
        | LoanStatus::Expired
        | LoanStatus::Defaulted => {}
        _ => panic!("loan is closed"),
    }
}

fn require_positive(amount: i128) {
    if amount <= 0 {
        panic!("amount must be positive");
    }
}

fn status_for_hf(loan: &Loan, hf_bps: u32) -> LoanStatus {
    if hf_bps >= effective_min_hf(loan) {
        LoanStatus::Active
    } else if hf_bps >= LIQUIDATION_HEALTH_FACTOR_BPS {
        LoanStatus::Warning
    } else {
        LoanStatus::LiquidationPlanning
    }
}

fn effective_min_hf(loan: &Loan) -> u32 {
    max_u32(loan.min_health_factor_bps, SAFE_HEALTH_FACTOR_BPS)
}

fn update_status(env: &Env, loan: &mut Loan) {
    if loan.outstanding_debt == 0 || loan.status == LoanStatus::PendingCollateral {
        return;
    }
    if matches!(
        loan.status,
        LoanStatus::Repaid | LoanStatus::Liquidated | LoanStatus::Closed
    ) {
        return;
    }
    let now = env.ledger().timestamp();
    let default_time = checked_u64_add(
        loan.due_time,
        checked_u64_mul(loan.grace_period_days as u64, SECONDS_PER_DAY),
    );
    if now > default_time {
        loan.status = LoanStatus::Defaulted;
        return;
    }
    if now > loan.due_time {
        loan.status = LoanStatus::Expired;
        return;
    }
    let hf = calculate_health_factor_for_loan(env, loan);
    loan.status = status_for_hf(loan, hf);
}

fn calculate_health_factor_for_loan(env: &Env, loan: &Loan) -> u32 {
    if loan.outstanding_debt <= 0 {
        return u32::MAX;
    }
    let collateral_value = collateral_value(env, loan);
    if collateral_value == 0 {
        return 0;
    }
    let numerator = checked_u128_mul(collateral_value, loan.liquidation_threshold_bps as u128);
    let hf = numerator / (loan.outstanding_debt as u128);
    if hf > u32::MAX as u128 {
        u32::MAX
    } else {
        hf as u32
    }
}

fn calculate_ltv_for_loan(env: &Env, loan: &Loan) -> u32 {
    let collateral_value = collateral_value(env, loan);
    if collateral_value == 0 {
        return u32::MAX;
    }
    let ltv = checked_u128_mul(loan.outstanding_debt as u128, BPS_DENOMINATOR) / collateral_value;
    if ltv > u32::MAX as u128 {
        u32::MAX
    } else {
        ltv as u32
    }
}

fn collateral_value(env: &Env, loan: &Loan) -> u128 {
    let price = get_oracle_price(env, &loan.collateral_asset, &loan.loan_asset);
    if price.price <= 0 {
        panic!("oracle price must be positive");
    }
    let scale = checked_pow10(price.decimals);
    checked_u128_mul(loan.collateral_amount as u128, price.price as u128) / scale
}

fn get_oracle_price(env: &Env, collateral_asset: &Address, loan_asset: &Address) -> PriceData {
    let oracle: Address = env
        .storage()
        .instance()
        .get(&DataKey::Oracle)
        .unwrap_or_else(|| panic!("oracle not configured"));
    env.invoke_contract(
        &oracle,
        &Symbol::new(env, "get_price_for_assets"),
        vec2(
            env,
            (
                collateral_asset.clone().into_val(env),
                loan_asset.clone().into_val(env),
            ),
        ),
    )
}

fn calculate_seize_collateral(env: &Env, loan: &Loan, repay_amount: i128) -> i128 {
    let price = get_oracle_price(env, &loan.collateral_asset, &loan.loan_asset);
    if price.price <= 0 {
        panic!("oracle price must be positive");
    }
    let scale = checked_pow10(price.decimals);
    let with_bonus_bps = checked_u128_add(BPS_DENOMINATOR, loan.liquidation_bonus_bps as u128);
    let repay_with_bonus = checked_u128_mul(repay_amount as u128, with_bonus_bps) / BPS_DENOMINATOR;
    let collateral = checked_u128_mul(repay_with_bonus, scale) / (price.price as u128);
    checked_u128_to_i128(collateral)
}

fn principal_with_interest(principal: i128, apr_bps: u32, duration_days: u32) -> i128 {
    let interest = checked_u128_mul(
        checked_u128_mul(principal as u128, apr_bps as u128),
        duration_days as u128,
    ) / (365_u128 * BPS_DENOMINATOR);
    checked_i128_add(principal, checked_u128_to_i128(interest))
}

fn release_all_collateral(env: &Env, loan: &mut Loan) {
    if loan.collateral_amount == 0 {
        return;
    }
    let amount = loan.collateral_amount;
    call_vault_release_collateral(
        env,
        loan.loan_id,
        &loan.borrower,
        &loan.collateral_asset,
        amount,
    );
    loan.collateral_amount = 0;
}

fn call_vault_lock_collateral(
    env: &Env,
    loan_id: u64,
    borrower: &Address,
    asset: &Address,
    amount: i128,
) {
    call_vault(
        env,
        "lock_borrower_collateral",
        vec4(
            env,
            (
                loan_id.into_val(env),
                borrower.clone().into_val(env),
                asset.clone().into_val(env),
                amount.into_val(env),
            ),
        ),
    );
}

fn call_vault_release_collateral(
    env: &Env,
    loan_id: u64,
    borrower: &Address,
    asset: &Address,
    amount: i128,
) {
    call_vault(
        env,
        "release_borrower_collateral",
        vec4(
            env,
            (
                loan_id.into_val(env),
                borrower.clone().into_val(env),
                asset.clone().into_val(env),
                amount.into_val(env),
            ),
        ),
    );
}

fn call_vault_transfer_loan_asset(
    env: &Env,
    offer_id: u64,
    loan_id: u64,
    borrower: &Address,
    asset: &Address,
    amount: i128,
) {
    call_vault(
        env,
        "transfer_loan_asset_to_borrower",
        vec5(
            env,
            (
                offer_id.into_val(env),
                loan_id.into_val(env),
                borrower.clone().into_val(env),
                asset.clone().into_val(env),
                amount.into_val(env),
            ),
        ),
    );
}

fn call_vault_collect_repayment(
    env: &Env,
    loan_id: u64,
    payer: &Address,
    lender: &Address,
    asset: &Address,
    amount: i128,
) {
    call_vault(
        env,
        "collect_repayment_from",
        vec5(
            env,
            (
                loan_id.into_val(env),
                payer.clone().into_val(env),
                lender.clone().into_val(env),
                asset.clone().into_val(env),
                amount.into_val(env),
            ),
        ),
    );
}

fn call_vault_transfer_collateral(
    env: &Env,
    loan_id: u64,
    liquidator: &Address,
    asset: &Address,
    amount: i128,
) {
    call_vault(
        env,
        "transfer_collateral_to_liq",
        vec4(
            env,
            (
                loan_id.into_val(env),
                liquidator.clone().into_val(env),
                asset.clone().into_val(env),
                amount.into_val(env),
            ),
        ),
    );
}

fn call_vault(env: &Env, fn_name: &str, args: Vec<Val>) {
    let vault: Address = env
        .storage()
        .instance()
        .get(&DataKey::Vault)
        .unwrap_or_else(|| panic!("vault not configured"));
    env.invoke_contract::<()>(&vault, &Symbol::new(env, fn_name), args);
}

fn vec2(env: &Env, vals: (Val, Val)) -> Vec<Val> {
    let mut args = Vec::new(env);
    args.push_back(vals.0);
    args.push_back(vals.1);
    args
}

fn vec4(env: &Env, vals: (Val, Val, Val, Val)) -> Vec<Val> {
    let mut args = Vec::new(env);
    args.push_back(vals.0);
    args.push_back(vals.1);
    args.push_back(vals.2);
    args.push_back(vals.3);
    args
}

fn vec5(env: &Env, vals: (Val, Val, Val, Val, Val)) -> Vec<Val> {
    let mut args = Vec::new(env);
    args.push_back(vals.0);
    args.push_back(vals.1);
    args.push_back(vals.2);
    args.push_back(vals.3);
    args.push_back(vals.4);
    args
}

fn checked_pow10(decimals: u32) -> u128 {
    10_u128
        .checked_pow(decimals)
        .unwrap_or_else(|| panic!("decimal scale overflow"))
}

fn checked_u128_add(a: u128, b: u128) -> u128 {
    a.checked_add(b)
        .unwrap_or_else(|| panic!("addition overflow"))
}

fn checked_u128_mul(a: u128, b: u128) -> u128 {
    a.checked_mul(b)
        .unwrap_or_else(|| panic!("multiplication overflow"))
}

fn checked_i128_add(a: i128, b: i128) -> i128 {
    a.checked_add(b)
        .unwrap_or_else(|| panic!("addition overflow"))
}

fn checked_u64_add(a: u64, b: u64) -> u64 {
    a.checked_add(b)
        .unwrap_or_else(|| panic!("timestamp overflow"))
}

fn checked_u64_mul(a: u64, b: u64) -> u64 {
    a.checked_mul(b)
        .unwrap_or_else(|| panic!("timestamp overflow"))
}

fn checked_u128_to_i128(value: u128) -> i128 {
    if value > i128::MAX as u128 {
        panic!("i128 overflow");
    }
    value as i128
}

fn min_i128(a: i128, b: i128) -> i128 {
    if a < b {
        a
    } else {
        b
    }
}

fn max_u32(a: u32, b: u32) -> u32 {
    if a > b {
        a
    } else {
        b
    }
}
