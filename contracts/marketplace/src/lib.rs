#![no_std]
#![allow(deprecated)]

use nexus_contracts_shared::{
    LoanOffer, OfferStatus, DEFAULT_LIQUIDATION_BONUS_BPS, SAFE_HEALTH_FACTOR_BPS,
};
use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, IntoVal, Symbol, Val, Vec,
};

#[cfg(test)]
mod test;

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Vault,
    LoanManager,
    OfferCount,
    Offer(u64),
}

#[contract]
pub struct MarketplaceContract;

#[contractimpl]
impl MarketplaceContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        vault_contract: Address,
        loan_manager_contract: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("marketplace already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Vault, &vault_contract);
        env.storage()
            .instance()
            .set(&DataKey::LoanManager, &loan_manager_contract);
        env.storage().instance().set(&DataKey::OfferCount, &0_u64);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_offer(
        env: Env,
        lender: Address,
        loan_asset: Address,
        loan_amount: i128,
        fixed_apr_bps: u32,
        duration_days: u32,
        collateral_asset: Address,
        max_ltv_bps: u32,
        liquidation_threshold_bps: u32,
        liquidation_bonus_bps: u32,
        grace_period_days: u32,
        min_health_factor_bps: u32,
    ) -> u64 {
        lender.require_auth();
        validate_offer_input(
            loan_amount,
            fixed_apr_bps,
            duration_days,
            max_ltv_bps,
            liquidation_threshold_bps,
            min_health_factor_bps,
        );

        let offer_id = next_offer_id(&env);
        let min_hf = if min_health_factor_bps == 0 {
            SAFE_HEALTH_FACTOR_BPS
        } else {
            min_health_factor_bps
        };
        let offer = LoanOffer {
            offer_id,
            lender: lender.clone(),
            loan_asset: loan_asset.clone(),
            loan_amount,
            fixed_apr_bps,
            duration_days,
            collateral_asset,
            max_ltv_bps,
            liquidation_threshold_bps,
            liquidation_bonus_bps: if liquidation_bonus_bps == 0 {
                DEFAULT_LIQUIDATION_BONUS_BPS
            } else {
                liquidation_bonus_bps
            },
            grace_period_days,
            min_health_factor_bps: min_hf,
            status: OfferStatus::Draft,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);
        env.events().publish(
            (Symbol::new(&env, "offer_created"), offer_id, lender),
            loan_amount,
        );
        offer_id
    }

    pub fn fund_offer(env: Env, offer_id: u64) {
        let mut offer = get_offer_or_panic(&env, offer_id);
        offer.lender.require_auth();
        if offer.status != OfferStatus::Draft {
            panic!("offer cannot be funded");
        }
        call_vault_lock_lender_funds(
            &env,
            offer_id,
            &offer.lender,
            &offer.loan_asset,
            offer.loan_amount,
        );
        offer.status = OfferStatus::Funding;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);
        env.events()
            .publish((Symbol::new(&env, "offer_funded"), offer_id), offer.loan_amount);
    }

    pub fn activate_offer(env: Env, offer_id: u64) {
        let mut offer = get_offer_or_panic(&env, offer_id);
        offer.lender.require_auth();
        if offer.status != OfferStatus::Funding {
            panic!("offer is not funded");
        }
        let locked = call_vault_get_offer_locked_amount(&env, offer_id);
        if locked < offer.loan_amount {
            panic!("offer funds not locked");
        }
        offer.status = OfferStatus::Active;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);
        env.events()
            .publish((Symbol::new(&env, "offer_activated"), offer_id), offer.loan_amount);
    }

    pub fn cancel_offer(env: Env, offer_id: u64) {
        let mut offer = get_offer_or_panic(&env, offer_id);
        offer.lender.require_auth();
        match offer.status {
            OfferStatus::Draft | OfferStatus::Funding | OfferStatus::Active => {}
            OfferStatus::Matched => panic!("matched offer cannot be cancelled"),
            OfferStatus::Cancelled => panic!("offer already cancelled"),
            OfferStatus::Expired => panic!("offer already expired"),
        }
        unlock_offer_if_needed(&env, &offer);
        offer.status = OfferStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);
        env.events()
            .publish((Symbol::new(&env, "offer_cancelled"), offer_id), offer.loan_amount);
    }

    pub fn expire_offer(env: Env, offer_id: u64) {
        let mut offer = get_offer_or_panic(&env, offer_id);
        match offer.status {
            OfferStatus::Draft | OfferStatus::Funding | OfferStatus::Active => {}
            OfferStatus::Matched => panic!("matched offer cannot expire"),
            OfferStatus::Cancelled => panic!("offer already cancelled"),
            OfferStatus::Expired => panic!("offer already expired"),
        }
        unlock_offer_if_needed(&env, &offer);
        offer.status = OfferStatus::Expired;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);
        env.events()
            .publish((Symbol::new(&env, "offer_expired"), offer_id), offer.loan_amount);
    }

    pub fn accept_offer(
        env: Env,
        offer_id: u64,
        borrower: Address,
        collateral_amount: i128,
    ) -> u64 {
        borrower.require_auth();
        if collateral_amount <= 0 {
            panic!("collateral amount must be positive");
        }
        let mut offer = get_offer_or_panic(&env, offer_id);
        if offer.status != OfferStatus::Active {
            panic!("offer is not active");
        }
        let loan_id = call_create_pending_loan_from_offer(
            &env,
            &offer,
            &borrower,
            collateral_amount,
        );
        offer.status = OfferStatus::Matched;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);
        env.events().publish(
            (Symbol::new(&env, "offer_matched"), offer_id, borrower),
            loan_id,
        );
        loan_id
    }

    pub fn get_offer(env: Env, offer_id: u64) -> LoanOffer {
        get_offer_or_panic(&env, offer_id)
    }

    pub fn get_offer_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::OfferCount)
            .unwrap_or(0_u64)
    }
}

fn validate_offer_input(
    loan_amount: i128,
    fixed_apr_bps: u32,
    duration_days: u32,
    max_ltv_bps: u32,
    liquidation_threshold_bps: u32,
    min_health_factor_bps: u32,
) {
    if loan_amount <= 0 {
        panic!("loan amount must be positive");
    }
    if fixed_apr_bps == 0 {
        panic!("fixed apr must be positive");
    }
    if duration_days == 0 {
        panic!("duration must be positive");
    }
    if max_ltv_bps == 0 || liquidation_threshold_bps == 0 {
        panic!("risk bps must be positive");
    }
    if max_ltv_bps > liquidation_threshold_bps {
        panic!("max ltv exceeds liquidation threshold");
    }
    if min_health_factor_bps != 0 && min_health_factor_bps < SAFE_HEALTH_FACTOR_BPS {
        panic!("min health factor below safe threshold");
    }
}

fn get_offer_or_panic(env: &Env, offer_id: u64) -> LoanOffer {
    env.storage()
        .persistent()
        .get(&DataKey::Offer(offer_id))
        .unwrap_or_else(|| panic!("offer not found"))
}

fn next_offer_id(env: &Env) -> u64 {
    let current = env
        .storage()
        .instance()
        .get(&DataKey::OfferCount)
        .unwrap_or(0_u64);
    let next = current + 1;
    env.storage().instance().set(&DataKey::OfferCount, &next);
    next
}

fn unlock_offer_if_needed(env: &Env, offer: &LoanOffer) {
    let locked = call_vault_get_offer_locked_amount(env, offer.offer_id);
    if locked > 0 {
        call_vault_unlock_lender_funds(
            env,
            offer.offer_id,
            &offer.lender,
            &offer.loan_asset,
            locked,
        );
    }
}

fn call_vault_lock_lender_funds(
    env: &Env,
    offer_id: u64,
    lender: &Address,
    asset: &Address,
    amount: i128,
) {
    let vault = get_vault(env);
    env.invoke_contract::<()>(
        &vault,
        &Symbol::new(env, "lock_lender_funds"),
        vec4(
            env,
            (
                offer_id.into_val(env),
                lender.clone().into_val(env),
                asset.clone().into_val(env),
                amount.into_val(env),
            ),
        ),
    );
}

fn call_vault_unlock_lender_funds(
    env: &Env,
    offer_id: u64,
    lender: &Address,
    asset: &Address,
    amount: i128,
) {
    let vault = get_vault(env);
    env.invoke_contract::<()>(
        &vault,
        &Symbol::new(env, "unlock_lender_funds"),
        vec4(
            env,
            (
                offer_id.into_val(env),
                lender.clone().into_val(env),
                asset.clone().into_val(env),
                amount.into_val(env),
            ),
        ),
    );
}

fn call_vault_get_offer_locked_amount(env: &Env, offer_id: u64) -> i128 {
    let vault = get_vault(env);
    env.invoke_contract(
        &vault,
        &Symbol::new(env, "get_offer_locked_amount"),
        vec1(env, offer_id.into_val(env)),
    )
}

fn call_create_pending_loan_from_offer(
    env: &Env,
    offer: &LoanOffer,
    borrower: &Address,
    collateral_amount: i128,
) -> u64 {
    let loan_manager: Address = env
        .storage()
        .instance()
        .get(&DataKey::LoanManager)
        .unwrap_or_else(|| panic!("loan manager not configured"));
    env.invoke_contract(
        &loan_manager,
        &Symbol::new(env, "create_pending_loan_from_offer"),
        vec3(
            env,
            (
                offer.clone().into_val(env),
                borrower.clone().into_val(env),
                collateral_amount.into_val(env),
            ),
        ),
    )
}

fn get_vault(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Vault)
        .unwrap_or_else(|| panic!("vault not configured"))
}

fn vec1(env: &Env, val: Val) -> Vec<Val> {
    let mut args = Vec::new(env);
    args.push_back(val);
    args
}

fn vec3(env: &Env, vals: (Val, Val, Val)) -> Vec<Val> {
    let mut args = Vec::new(env);
    args.push_back(vals.0);
    args.push_back(vals.1);
    args.push_back(vals.2);
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
