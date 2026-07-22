use nexus_contracts_shared::{LoanStatus, OfferStatus};
use nexus_loan_manager_contract::{LoanManagerContract, LoanManagerContractClient};
use nexus_marketplace_contract::{MarketplaceContract, MarketplaceContractClient};
use nexus_oracle_contract::{OracleContract, OracleContractClient};
use nexus_vault_contract::{VaultContract, VaultContractClient};
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

struct Fixture<'a> {
    env: &'a Env,
    lender: Address,
    borrower: Address,
    liquidator: Address,
    loan_asset: Address,
    collateral_asset: Address,
    marketplace: MarketplaceContractClient<'a>,
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
    let marketplace_id = env.register(MarketplaceContract, ());

    let oracle = OracleContractClient::new(env, &oracle_id);
    let vault = VaultContractClient::new(env, &vault_id);
    let loan_manager = LoanManagerContractClient::new(env, &loan_manager_id);
    let marketplace = MarketplaceContractClient::new(env, &marketplace_id);

    oracle.initialize(&admin);
    vault.initialize(&admin, &marketplace_id, &loan_manager_id);
    loan_manager.initialize(&admin, &marketplace_id, &vault_id, &oracle_id);
    marketplace.initialize(&admin, &vault_id, &loan_manager_id);
    oracle.set_price_for_assets(
        &collateral_asset,
        &loan_asset,
        &String::from_str(env, "XLM/USDC"),
        &10,
        &0,
        &String::from_str(env, "test"),
    );

    Fixture {
        env,
        lender,
        borrower,
        liquidator,
        loan_asset,
        collateral_asset,
        marketplace,
        loan_manager,
        oracle,
        vault,
        loan_token,
        collateral_token,
    }
}

fn create_active_offer(f: &Fixture) -> u64 {
    let offer_id = f.marketplace.create_offer(
        &f.lender,
        &f.loan_asset,
        &100,
        &1_825,
        &20,
        &f.collateral_asset,
        &7_000,
        &8_000,
        &500,
        &3,
        &0,
    );
    f.marketplace.fund_offer(&offer_id);
    f.marketplace.activate_offer(&offer_id);
    offer_id
}

#[test]
fn full_lending_flow_repay() {
    let f = setup();

    let offer_id = create_active_offer(&f);
    let loan_id = f.marketplace.accept_offer(&offer_id, &f.borrower, &20);
    f.loan_manager.activate_loan(&loan_id);

    assert_eq!(
        f.marketplace.get_offer(&offer_id).status,
        OfferStatus::Matched
    );
    assert_eq!(f.loan_manager.get_loan(&loan_id).status, LoanStatus::Active);
    assert_eq!(f.vault.get_offer_locked_amount(&offer_id), 0);
    assert_eq!(f.vault.get_loan_collateral_amount(&loan_id), 20);
    assert_eq!(f.loan_token.balance(&f.borrower), 10_100);

    f.loan_manager.full_repay(&loan_id);
    let loan = f.loan_manager.get_loan(&loan_id);

    assert_eq!(loan.status, LoanStatus::Repaid);
    assert_eq!(loan.outstanding_debt, 0);
    assert_eq!(loan.collateral_amount, 0);
    assert_eq!(f.vault.get_loan_collateral_amount(&loan_id), 0);
}

#[test]
fn price_drop_to_partial_liquidation_flow() {
    let f = setup();

    let offer_id = create_active_offer(&f);
    let loan_id = f.marketplace.accept_offer(&offer_id, &f.borrower, &20);
    f.loan_manager.activate_loan(&loan_id);
    f.oracle.set_price_for_assets(
        &f.collateral_asset,
        &f.loan_asset,
        &String::from_str(f.env, "XLM/USDC"),
        &7,
        &0,
        &String::from_str(f.env, "test"),
    );

    assert_eq!(
        f.loan_manager.refresh_loan_state(&loan_id),
        LoanStatus::LiquidationPlanning
    );
    let before = f.collateral_token.balance(&f.liquidator);
    f.loan_manager.liquidate(&loan_id, &f.liquidator, &80);
    let loan = f.loan_manager.get_loan(&loan_id);

    assert!(loan.outstanding_debt < 101);
    assert!(loan.collateral_amount < 20);
    assert!(f.collateral_token.balance(&f.liquidator) > before);
}
