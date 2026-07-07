#![no_std]
#![allow(deprecated)]

use nexus_contracts_shared::{
  ContractError, LoanOffer, OfferStatus, DEFAULT_LIQUIDATION_BONUS_BPS, SAFE_HEALTH_FACTOR_BPS,
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
  ) -> Result<(), ContractError> {
    if env.storage().instance().has(&DataKey::Admin) {
      return Err(ContractError::AlreadyInitialized);
    }
    env.storage().instance().set(&DataKey::Admin, &admin);
    env.storage().instance().set(&DataKey::Vault, &vault_contract);
    env.storage()
      .instance()
      .set(&DataKey::LoanManager, &loan_manager_contract);
    env.storage().instance().set(&DataKey::OfferCount, &0_u64);
    Ok(())
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
  ) -> Result<u64, ContractError> {
    lender.require_auth();
    validate_offer_input(
      loan_amount,
      fixed_apr_bps,
      duration_days,
      max_ltv_bps,
      liquidation_threshold_bps,
      min_health_factor_bps,
    )?;

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
    Ok(offer_id)
  }

  pub fn fund_offer(env: Env, offer_id: u64) -> Result<(), ContractError> {
    let mut offer = get_offer_internal(&env, offer_id)?;
    offer.lender.require_auth();
    if offer.status != OfferStatus::Draft {
      return Err(ContractError::OfferNotDraft);
    }
    call_vault_lock_lender_funds(
      &env,
      offer_id,
      &offer.lender,
      &offer.loan_asset,
      offer.loan_amount,
    )?;
    offer.status = OfferStatus::Funding;
    env.storage()
      .persistent()
      .set(&DataKey::Offer(offer_id), &offer);
    env.events()
      .publish((Symbol::new(&env, "offer_funded"), offer_id), offer.loan_amount);
    Ok(())
  }

  pub fn activate_offer(env: Env, offer_id: u64) -> Result<(), ContractError> {
    let mut offer = get_offer_internal(&env, offer_id)?;
    offer.lender.require_auth();
    if offer.status != OfferStatus::Funding {
      return Err(ContractError::OfferNotFunded);
    }
    let locked = call_vault_get_offer_locked_amount(&env, offer_id)?;
    if locked < offer.loan_amount {
      return Err(ContractError::InsufficientLockedFunds);
    }
    offer.status = OfferStatus::Active;
    env.storage()
      .persistent()
      .set(&DataKey::Offer(offer_id), &offer);
    env.events()
      .publish((Symbol::new(&env, "offer_activated"), offer_id), offer.loan_amount);
    Ok(())
  }

  pub fn cancel_offer(env: Env, offer_id: u64) -> Result<(), ContractError> {
    let mut offer = get_offer_internal(&env, offer_id)?;
    offer.lender.require_auth();
    match offer.status {
      OfferStatus::Draft | OfferStatus::Funding | OfferStatus::Active => {}
      OfferStatus::Matched => return Err(ContractError::OfferMatched),
      OfferStatus::Cancelled => return Err(ContractError::OfferAlreadyCancelled),
      OfferStatus::Expired => return Err(ContractError::OfferAlreadyExpired),
    }
    unlock_offer_if_needed(&env, &offer)?;
    offer.status = OfferStatus::Cancelled;
    env.storage()
      .persistent()
      .set(&DataKey::Offer(offer_id), &offer);
    env.events()
      .publish((Symbol::new(&env, "offer_cancelled"), offer_id), offer.loan_amount);
    Ok(())
  }

  pub fn expire_offer(env: Env, offer_id: u64) -> Result<(), ContractError> {
    let mut offer = get_offer_internal(&env, offer_id)?;
    match offer.status {
      OfferStatus::Draft | OfferStatus::Funding | OfferStatus::Active => {}
      OfferStatus::Matched => return Err(ContractError::OfferMatched),
      OfferStatus::Cancelled => return Err(ContractError::OfferAlreadyCancelled),
      OfferStatus::Expired => return Err(ContractError::OfferAlreadyExpired),
    }
    unlock_offer_if_needed(&env, &offer)?;
    offer.status = OfferStatus::Expired;
    env.storage()
      .persistent()
      .set(&DataKey::Offer(offer_id), &offer);
    env.events()
      .publish((Symbol::new(&env, "offer_expired"), offer_id), offer.loan_amount);
    Ok(())
  }

  pub fn accept_offer(
    env: Env,
    offer_id: u64,
    borrower: Address,
    collateral_amount: i128,
  ) -> Result<u64, ContractError> {
    borrower.require_auth();
    if collateral_amount <= 0 {
      return Err(ContractError::InvalidCollateralAmount);
    }
    let mut offer = get_offer_internal(&env, offer_id)?;
    if offer.status != OfferStatus::Active {
      return Err(ContractError::OfferNotActive);
    }
    let loan_id = call_create_pending_loan_from_offer(
      &env,
      &offer,
      &borrower,
      collateral_amount,
    )?;
    offer.status = OfferStatus::Matched;
    env.storage()
      .persistent()
      .set(&DataKey::Offer(offer_id), &offer);
    env.events().publish(
      (Symbol::new(&env, "offer_matched"), offer_id, borrower),
      loan_id,
    );
    Ok(loan_id)
  }

  pub fn get_offer(env: Env, offer_id: u64) -> Result<LoanOffer, ContractError> {
    get_offer_internal(&env, offer_id)
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
) -> Result<(), ContractError> {
  if loan_amount <= 0 {
    return Err(ContractError::InvalidLoanAmount);
  }
  if fixed_apr_bps == 0 {
    return Err(ContractError::InvalidApr);
  }
  if duration_days == 0 {
    return Err(ContractError::InvalidDuration);
  }
  if max_ltv_bps == 0 || liquidation_threshold_bps == 0 {
    return Err(ContractError::InvalidLiquidationThreshold);
  }
  if max_ltv_bps > liquidation_threshold_bps {
    return Err(ContractError::LtvExceedsThreshold);
  }
  if min_health_factor_bps != 0 && min_health_factor_bps < SAFE_HEALTH_FACTOR_BPS {
    return Err(ContractError::InvalidMinHealthFactor);
  }
  Ok(())
}

fn get_offer_internal(env: &Env, offer_id: u64) -> Result<LoanOffer, ContractError> {
  env.storage()
    .persistent()
    .get(&DataKey::Offer(offer_id))
    .ok_or(ContractError::OfferNotFound)
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

fn unlock_offer_if_needed(env: &Env, offer: &LoanOffer) -> Result<(), ContractError> {
  let locked = call_vault_get_offer_locked_amount(env, offer.offer_id)?;
  if locked > 0 {
    call_vault_unlock_lender_funds(
      env,
      offer.offer_id,
      &offer.lender,
      &offer.loan_asset,
      locked,
    )?;
  }
  Ok(())
}

fn call_vault_lock_lender_funds(
  env: &Env,
  offer_id: u64,
  lender: &Address,
  asset: &Address,
  amount: i128,
) -> Result<(), ContractError> {
  let vault = get_vault(env)?;
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
  Ok(())
}

fn call_vault_unlock_lender_funds(
  env: &Env,
  offer_id: u64,
  lender: &Address,
  asset: &Address,
  amount: i128,
) -> Result<(), ContractError> {
  let vault = get_vault(env)?;
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
  Ok(())
}

fn call_vault_get_offer_locked_amount(env: &Env, offer_id: u64) -> Result<i128, ContractError> {
  let vault = get_vault(env)?;
  Ok(env.invoke_contract(
    &vault,
    &Symbol::new(env, "get_offer_locked_amount"),
    vec1(env, offer_id.into_val(env)),
  ))
}

fn call_create_pending_loan_from_offer(
  env: &Env,
  offer: &LoanOffer,
  borrower: &Address,
  collateral_amount: i128,
) -> Result<u64, ContractError> {
  let loan_manager: Address = env
    .storage()
    .instance()
    .get(&DataKey::LoanManager)
    .ok_or(ContractError::LoanManagerNotConfigured)?;
  Ok(env.invoke_contract(
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
  ))
}

fn get_vault(env: &Env) -> Result<Address, ContractError> {
  env.storage()
    .instance()
    .get(&DataKey::Vault)
    .ok_or(ContractError::VaultNotConfigured)
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
