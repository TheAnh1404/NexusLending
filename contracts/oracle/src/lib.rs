#![no_std]
#![allow(deprecated)]

use nexus_contracts_shared::PriceData;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

#[cfg(test)]
mod test;

const MAX_PRICE_DECIMALS: u32 = 18;
const MAX_PRICE_AGE_SECONDS: u64 = 86_400;
const LEDGERS_PER_DAY: u32 = 17_280;
const TTL_THRESHOLD: u32 = 7 * LEDGERS_PER_DAY;
const TTL_EXTEND_TO: u32 = 365 * LEDGERS_PER_DAY;

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
        bump_instance(&env);
    }

    pub fn set_price(env: Env, asset_pair: String, price: i128, decimals: u32, source: String) {
        let admin = require_admin(&env);
        validate_price(price, decimals);

        let data = PriceData {
            asset_pair: asset_pair.clone(),
            price,
            decimals,
            updated_at: env.ledger().timestamp(),
            source,
        };
        store_price(&env, DataKey::Price(asset_pair.clone()), &data);
        env.events().publish(
            (Symbol::new(&env, "price_updated"), asset_pair, admin),
            data.price,
        );
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
        let admin = require_admin(&env);
        validate_price(price, decimals);

        let data = PriceData {
            asset_pair: asset_pair.clone(),
            price,
            decimals,
            updated_at: env.ledger().timestamp(),
            source,
        };
        store_price(
            &env,
            DataKey::AssetPrice(base_asset.clone(), quote_asset.clone()),
            &data,
        );
        store_price(&env, DataKey::Price(asset_pair.clone()), &data);
        env.events().publish(
            (
                Symbol::new(&env, "price_updated"),
                base_asset,
                quote_asset,
                admin,
            ),
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

    pub fn get_fresh_price(env: Env, asset_pair: String) -> PriceData {
        let data = Self::get_price(env.clone(), asset_pair);
        reject_stale_price(&env, data.updated_at);
        data
    }

    pub fn get_fresh_price_for_assets(
        env: Env,
        base_asset: Address,
        quote_asset: Address,
    ) -> PriceData {
        let data = Self::get_price_for_assets(env.clone(), base_asset, quote_asset);
        reject_stale_price(&env, data.updated_at);
        data
    }

    pub fn get_last_updated(env: Env, asset_pair: String) -> u64 {
        Self::get_price(env, asset_pair).updated_at
    }

    pub fn is_price_stale(env: Env, asset_pair: String) -> bool {
        let price: Option<PriceData> = env.storage().persistent().get(&DataKey::Price(asset_pair));
        match price {
            Some(data) => is_stale(&env, data.updated_at),
            None => true,
        }
    }

    pub fn is_price_for_assets_stale(env: Env, base_asset: Address, quote_asset: Address) -> bool {
        let price: Option<PriceData> = env
            .storage()
            .persistent()
            .get(&DataKey::AssetPrice(base_asset, quote_asset));
        match price {
            Some(data) => is_stale(&env, data.updated_at),
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

fn store_price(env: &Env, key: DataKey, data: &PriceData) {
    env.storage().persistent().set(&key, data);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    bump_instance(env);
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn validate_price(price: i128, decimals: u32) {
    if price <= 0 {
        panic!("price must be positive");
    }
    if decimals > MAX_PRICE_DECIMALS {
        panic!("invalid price decimals");
    }
}

fn is_stale(env: &Env, updated_at: u64) -> bool {
    env.ledger().timestamp().saturating_sub(updated_at) > MAX_PRICE_AGE_SECONDS
}

fn reject_stale_price(env: &Env, updated_at: u64) {
    if is_stale(env, updated_at) {
        panic!("oracle price is stale");
    }
}
