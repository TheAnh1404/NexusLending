#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractimpl, contracttype, token::TokenClient, Address, Env, MuxedAddress, Symbol,
};

#[cfg(test)]
mod test;

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Marketplace,
    LoanManager,
    OfferLocked(u64),
    LoanCollateral(u64),
    Locked(u64, Address),
}

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        marketplace_contract: Address,
        loan_manager_contract: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("vault already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::Marketplace, &marketplace_contract);
        env.storage()
            .instance()
            .set(&DataKey::LoanManager, &loan_manager_contract);
    }

    pub fn lock_lender_funds(
        env: Env,
        offer_id: u64,
        lender: Address,
        asset: Address,
        amount: i128,
    ) {
        require_positive(amount);
        require_marketplace(&env);
        lender.require_auth();

        let vault = env.current_contract_address();
        TokenClient::new(&env, &asset).transfer(&lender, &MuxedAddress::from(vault), &amount);
        increase_offer_locked(&env, offer_id, amount);
        env.events().publish(
            (
                Symbol::new(&env, "lender_funds_locked"),
                offer_id,
                lender,
                asset,
            ),
            amount,
        );
    }

    pub fn unlock_lender_funds(
        env: Env,
        offer_id: u64,
        lender: Address,
        asset: Address,
        amount: i128,
    ) {
        require_positive(amount);
        require_marketplace(&env);
        decrease_offer_locked(&env, offer_id, amount);
        transfer_from_vault(&env, &asset, &lender, amount);
        env.events().publish(
            (
                Symbol::new(&env, "lender_funds_unlocked"),
                offer_id,
                lender,
                asset,
            ),
            amount,
        );
    }

    pub fn lock_borrower_collateral(
        env: Env,
        loan_id: u64,
        borrower: Address,
        asset: Address,
        amount: i128,
    ) {
        require_positive(amount);
        require_loan_manager(&env);
        borrower.require_auth();

        let vault = env.current_contract_address();
        TokenClient::new(&env, &asset).transfer(&borrower, &MuxedAddress::from(vault), &amount);
        increase_loan_collateral(&env, loan_id, &asset, amount);
        env.events().publish(
            (
                Symbol::new(&env, "collateral_locked"),
                loan_id,
                borrower,
                asset,
            ),
            amount,
        );
    }

    pub fn release_borrower_collateral(
        env: Env,
        loan_id: u64,
        borrower: Address,
        asset: Address,
        amount: i128,
    ) {
        require_positive(amount);
        require_loan_manager(&env);
        decrease_loan_collateral(&env, loan_id, &asset, amount);
        transfer_from_vault(&env, &asset, &borrower, amount);
        env.events().publish(
            (
                Symbol::new(&env, "collateral_released"),
                loan_id,
                borrower,
                asset,
            ),
            amount,
        );
    }

    pub fn transfer_loan_asset_to_borrower(
        env: Env,
        offer_id: u64,
        loan_id: u64,
        borrower: Address,
        asset: Address,
        amount: i128,
    ) {
        require_positive(amount);
        require_loan_manager(&env);
        decrease_offer_locked(&env, offer_id, amount);
        transfer_from_vault(&env, &asset, &borrower, amount);
        env.events().publish(
            (
                Symbol::new(&env, "loan_asset_transferred"),
                offer_id,
                loan_id,
                borrower,
                asset,
            ),
            amount,
        );
    }

    pub fn transfer_repayment_to_lender(
        env: Env,
        loan_id: u64,
        lender: Address,
        asset: Address,
        amount: i128,
    ) {
        require_positive(amount);
        require_loan_manager(&env);
        transfer_from_vault(&env, &asset, &lender, amount);
        env.events().publish(
            (
                Symbol::new(&env, "repayment_transferred"),
                loan_id,
                lender,
                asset,
            ),
            amount,
        );
    }

    pub fn collect_repayment_from(
        env: Env,
        loan_id: u64,
        payer: Address,
        lender: Address,
        asset: Address,
        amount: i128,
    ) {
        require_positive(amount);
        require_loan_manager(&env);
        payer.require_auth();
        TokenClient::new(&env, &asset).transfer(
            &payer,
            &MuxedAddress::from(lender.clone()),
            &amount,
        );
        env.events().publish(
            (
                Symbol::new(&env, "repayment_transferred"),
                loan_id,
                payer,
                lender,
                asset,
            ),
            amount,
        );
    }

    pub fn transfer_collateral_to_liq(
        env: Env,
        loan_id: u64,
        liquidator: Address,
        asset: Address,
        amount: i128,
    ) {
        require_positive(amount);
        require_loan_manager(&env);
        decrease_loan_collateral(&env, loan_id, &asset, amount);
        transfer_from_vault(&env, &asset, &liquidator, amount);
        env.events().publish(
            (
                Symbol::new(&env, "collateral_to_liquidator"),
                loan_id,
                liquidator,
                asset,
            ),
            amount,
        );
    }

    pub fn get_offer_locked_amount(env: Env, offer_id: u64) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::OfferLocked(offer_id))
            .unwrap_or(0_i128)
    }

    pub fn get_loan_collateral_amount(env: Env, loan_id: u64) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::LoanCollateral(loan_id))
            .unwrap_or(0_i128)
    }

    pub fn deposit(env: Env, asset: Address, from: Address, amount: i128) {
        require_positive(amount);
        from.require_auth();
        let vault = env.current_contract_address();
        TokenClient::new(&env, &asset).transfer(&from, &MuxedAddress::from(vault), &amount);
        env.events()
            .publish((Symbol::new(&env, "deposit"), asset, from), amount);
    }

    pub fn withdraw(env: Env, asset: Address, to: Address, amount: i128) {
        require_positive(amount);
        require_admin(&env);
        transfer_from_vault(&env, &asset, &to, amount);
        env.events()
            .publish((Symbol::new(&env, "withdraw"), asset, to), amount);
    }

    pub fn lock_collateral(
        env: Env,
        loan_id: u64,
        borrower: Address,
        asset: Address,
        amount: i128,
    ) {
        Self::lock_borrower_collateral(env, loan_id, borrower, asset, amount);
    }

    pub fn release_collateral(
        env: Env,
        loan_id: u64,
        borrower: Address,
        asset: Address,
        amount: i128,
    ) {
        Self::release_borrower_collateral(env, loan_id, borrower, asset, amount);
    }

    pub fn return_loan_asset_to_lender(
        env: Env,
        offer_id: u64,
        lender: Address,
        asset: Address,
        amount: i128,
    ) {
        Self::unlock_lender_funds(env, offer_id, lender, asset, amount);
    }

    pub fn get_locked(env: Env, loan_id: u64, asset: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Locked(loan_id, asset))
            .unwrap_or(0_i128)
    }
}

fn require_admin(env: &Env) -> Address {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic!("vault not initialized"));
    admin.require_auth();
    admin
}

fn require_loan_manager(env: &Env) -> Address {
    let trusted: Address = env
        .storage()
        .instance()
        .get(&DataKey::LoanManager)
        .unwrap_or_else(|| panic!("loan manager not configured"));
    trusted.require_auth();
    trusted
}

fn require_marketplace(env: &Env) -> Address {
    let trusted: Address = env
        .storage()
        .instance()
        .get(&DataKey::Marketplace)
        .unwrap_or_else(|| panic!("marketplace not configured"));
    trusted.require_auth();
    trusted
}

fn require_positive(amount: i128) {
    if amount <= 0 {
        panic!("amount must be positive");
    }
}

fn transfer_from_vault(env: &Env, asset: &Address, to: &Address, amount: i128) {
    let vault = env.current_contract_address();
    TokenClient::new(env, asset).transfer(&vault, &MuxedAddress::from(to), &amount);
}

fn increase_offer_locked(env: &Env, offer_id: u64, amount: i128) {
    let key = DataKey::OfferLocked(offer_id);
    let current = env.storage().persistent().get(&key).unwrap_or(0_i128);
    env.storage()
        .persistent()
        .set(&key, &checked_i128_add(current, amount));
}

fn decrease_offer_locked(env: &Env, offer_id: u64, amount: i128) {
    let key = DataKey::OfferLocked(offer_id);
    let current = env.storage().persistent().get(&key).unwrap_or(0_i128);
    if current < amount {
        panic!("insufficient locked lender funds");
    }
    env.storage().persistent().set(&key, &(current - amount));
}

fn increase_loan_collateral(env: &Env, loan_id: u64, asset: &Address, amount: i128) {
    let loan_key = DataKey::LoanCollateral(loan_id);
    let current = env.storage().persistent().get(&loan_key).unwrap_or(0_i128);
    env.storage()
        .persistent()
        .set(&loan_key, &checked_i128_add(current, amount));

    let asset_key = DataKey::Locked(loan_id, asset.clone());
    let asset_current = env
        .storage()
        .persistent()
        .get(&asset_key)
        .unwrap_or(0_i128);
    env.storage()
        .persistent()
        .set(&asset_key, &checked_i128_add(asset_current, amount));
}

fn decrease_loan_collateral(env: &Env, loan_id: u64, asset: &Address, amount: i128) {
    let loan_key = DataKey::LoanCollateral(loan_id);
    let current = env.storage().persistent().get(&loan_key).unwrap_or(0_i128);
    if current < amount {
        panic!("insufficient locked collateral");
    }
    env.storage().persistent().set(&loan_key, &(current - amount));

    let asset_key = DataKey::Locked(loan_id, asset.clone());
    let asset_current = env
        .storage()
        .persistent()
        .get(&asset_key)
        .unwrap_or(0_i128);
    if asset_current < amount {
        panic!("insufficient locked collateral");
    }
    env.storage()
        .persistent()
        .set(&asset_key, &(asset_current - amount));
}

fn checked_i128_add(a: i128, b: i128) -> i128 {
    a.checked_add(b)
        .unwrap_or_else(|| panic!("addition overflow"))
}
