extern crate std;

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, String};
use std::boxed::Box;

fn setup() -> (&'static Env, Address, OracleContractClient<'static>) {
    let env = Box::leak(Box::new(Env::default()));
    let admin = Address::generate(env);
    let contract_id = env.register(OracleContract, ());
    let client = OracleContractClient::new(env, &contract_id);
    client.initialize(&admin);
    (env, admin, client)
}

#[test]
fn initialize_oracle() {
    let (env, admin, _) = setup();
    assert_ne!(admin, Address::generate(env));
}

#[test]
fn admin_set_price() {
    let (env, _, client) = setup();
    env.mock_all_auths();

    client.set_price(
        &String::from_str(env, "XLM/USDC"),
        &2_500_000,
        &7,
        &String::from_str(env, "admin"),
    );

    let price = client.get_price(&String::from_str(env, "XLM/USDC"));
    assert_eq!(price.price, 2_500_000);
    assert_eq!(price.decimals, 7);
    assert_eq!(price.source, String::from_str(env, "admin"));
}

#[test]
fn non_admin_cannot_set_price() {
    let (env, _, client) = setup();

    let result = client.try_set_price(
        &String::from_str(env, "XLM/USDC"),
        &2_500_000,
        &7,
        &String::from_str(env, "admin"),
    );

    assert!(result.is_err());
}

#[test]
fn get_price() {
    let (env, _, client) = setup();
    env.mock_all_auths();

    client.set_price(
        &String::from_str(env, "XLM/USDC"),
        &2_500_000,
        &7,
        &String::from_str(env, "admin"),
    );

    assert_eq!(
        client.get_price(&String::from_str(env, "XLM/USDC")).price,
        2_500_000
    );
}

#[test]
fn update_price() {
    let (env, _, client) = setup();
    env.mock_all_auths();

    client.set_price(
        &String::from_str(env, "XLM/USDC"),
        &2_500_000,
        &7,
        &String::from_str(env, "admin"),
    );
    env.ledger().set_timestamp(100);
    client.set_price(
        &String::from_str(env, "XLM/USDC"),
        &1_500_000,
        &7,
        &String::from_str(env, "admin"),
    );

    let price = client.get_price(&String::from_str(env, "XLM/USDC"));
    assert_eq!(price.price, 1_500_000);
    assert_eq!(client.get_last_updated(&String::from_str(env, "XLM/USDC")), 100);
}

#[test]
fn reject_zero_price() {
    let (env, _, client) = setup();
    env.mock_all_auths();

    let result = client.try_set_price(
        &String::from_str(env, "XLM/USDC"),
        &0,
        &7,
        &String::from_str(env, "admin"),
    );

    assert!(result.is_err());
}

#[test]
fn stale_price_detection() {
    let (env, _, client) = setup();
    env.mock_all_auths();
    env.ledger().set_timestamp(100);
    client.set_price(
        &String::from_str(env, "XLM/USDC"),
        &2_500_000,
        &7,
        &String::from_str(env, "admin"),
    );

    assert!(!client.is_price_stale(&String::from_str(env, "XLM/USDC")));
    env.ledger().set_timestamp(100 + MAX_PRICE_AGE_SECONDS + 1);
    assert!(client.is_price_stale(&String::from_str(env, "XLM/USDC")));
}
