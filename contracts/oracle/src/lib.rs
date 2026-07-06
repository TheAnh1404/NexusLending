#![no_std]
#![allow(deprecated)]

use nexus_contracts_shared::PriceData;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

#[cfg(test)]
mod test;

const MAX_PRICE_DECIMALS: u32 = 18;
const MAX_PRICE_AGE_SECONDS: u64 = 86_400;

#[derive(Clone)]
#[contracttype]
enum DataKey {
    Admin,
    Price(String),
    AssetPrice(Address, Address),
}

#[contract]
pub struct OracleContract;

#[contractimpl]
impl OracleContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("oracle already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_price(env: Env, asset_pair: String, price: i128, decimals: u32, source: String) {
        require_admin(&env);
        validate_price(price, decimals);

        let data = PriceData {
            asset_pair: asset_pair.clone(),
            price,
            decimals,
            updated_at: env.ledger().timestamp(),
            source,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Price(asset_pair.clone()), &data);
        env.events()
            .publish((Symbol::new(&env, "price_updated"), asset_pair), data.price);
    }

    pub fn set_price_for_assets(
        env: Env,
        base_asset: Address,
        quote_asset: Address,
        asset_pair: String,
        price: i128,
        decimals: u32,
        source: String,
    ) {
        require_admin(&env);
        validate_price(price, decimals);

        let data = PriceData {
            asset_pair: asset_pair.clone(),
            price,
            decimals,
            updated_at: env.ledger().timestamp(),
            source,
        };
        env.storage().persistent().set(
            &DataKey::AssetPrice(base_asset.clone(), quote_asset.clone()),
            &data,
        );
        env.storage()
            .persistent()
            .set(&DataKey::Price(asset_pair.clone()), &data);
        env.events().publish(
            (Symbol::new(&env, "price_updated"), base_asset, quote_asset),
            data.price,
        );
    }

    pub fn get_price(env: Env, asset_pair: String) -> PriceData {
        env.storage()
            .persistent()
            .get(&DataKey::Price(asset_pair))
            .unwrap_or_else(|| panic!("price not found"))
    }

    pub fn get_price_for_assets(env: Env, base_asset: Address, quote_asset: Address) -> PriceData {
        env.storage()
            .persistent()
            .get(&DataKey::AssetPrice(base_asset, quote_asset))
            .unwrap_or_else(|| panic!("asset price not found"))
    }

    pub fn get_last_updated(env: Env, asset_pair: String) -> u64 {
        Self::get_price(env, asset_pair).updated_at
    }

    pub fn is_price_stale(env: Env, asset_pair: String) -> bool {
        let price: Option<PriceData> = env
            .storage()
            .persistent()
            .get(&DataKey::Price(asset_pair));
        match price {
            Some(data) => {
                env.ledger().timestamp().saturating_sub(data.updated_at) > MAX_PRICE_AGE_SECONDS
            }
            None => true,
        }
    }
}

fn require_admin(env: &Env) -> Address {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .unwrap_or_else(|| panic!("oracle not initialized"));
    admin.require_auth();
    admin
}

fn validate_price(price: i128, decimals: u32) {
    if price <= 0 {
        panic!("price must be positive");
    }
    if decimals > MAX_PRICE_DECIMALS {
        panic!("invalid price decimals");
    }
}
