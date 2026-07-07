#![no_std]

use soroban_sdk::{contracterror, contracttype, Address, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidLoanAmount = 10,
    InvalidApr = 11,
    InvalidDuration = 12,
    InvalidMaxLtv = 13,
    InvalidLiquidationThreshold = 14,
    InvalidLiquidationBonus = 15,
    InvalidMinHealthFactor = 16,
    InvalidCollateralAmount = 17,
    InvalidAmount = 18,
    LtvExceedsThreshold = 19,
    OfferNotFound = 20,
    OfferNotDraft = 21,
    OfferNotFunded = 22,
    OfferNotActive = 23,
    OfferAlreadyCancelled = 24,
    OfferAlreadyExpired = 25,
    OfferMatched = 26,
    InsufficientLockedFunds = 27,
    VaultNotConfigured = 30,
    LoanManagerNotConfigured = 31,
    MarketplaceNotConfigured = 32,
    Overflow = 40,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum OfferStatus {
    Draft,
    Funding,
    Active,
    Matched,
    Cancelled,
    Expired,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum LoanStatus {
    PendingCollateral,
    Active,
    Warning,
    LiquidationPlanning,
    Repaid,
    Liquidated,
    Expired,
    Defaulted,
    Closed,
}

#[derive(Clone)]
#[contracttype]
pub struct LoanOffer {
    pub offer_id: u64,
    pub lender: Address,
    pub loan_asset: Address,
    pub loan_amount: i128,
    pub fixed_apr_bps: u32,
    pub duration_days: u32,
    pub collateral_asset: Address,
    pub max_ltv_bps: u32,
    pub liquidation_threshold_bps: u32,
    pub liquidation_bonus_bps: u32,
    pub grace_period_days: u32,
    pub min_health_factor_bps: u32,
    pub status: OfferStatus,
}

#[derive(Clone)]
#[contracttype]
pub struct Loan {
    pub loan_id: u64,
    pub offer_id: u64,
    pub lender: Address,
    pub borrower: Address,
    pub loan_asset: Address,
    pub principal: i128,
    pub outstanding_debt: i128,
    pub fixed_apr_bps: u32,
    pub duration_days: u32,
    pub collateral_asset: Address,
    pub collateral_amount: i128,
    pub start_time: u64,
    pub due_time: u64,
    pub max_ltv_bps: u32,
    pub liquidation_threshold_bps: u32,
    pub liquidation_bonus_bps: u32,
    pub min_health_factor_bps: u32,
    pub grace_period_days: u32,
    pub status: LoanStatus,
}

#[derive(Clone)]
#[contracttype]
pub struct PriceData {
    pub asset_pair: String,
    pub price: i128,
    pub decimals: u32,
    pub updated_at: u64,
    pub source: String,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
  AlreadyInitialized = 1,
  NotInitialized = 2,
  Unauthorized = 3,
  InvalidLoanAmount = 10,
  InvalidApr = 11,
  InvalidDuration = 12,
  InvalidMaxLtv = 13,
  InvalidLiquidationThreshold = 14,
  InvalidLiquidationBonus = 15,
  InvalidMinHealthFactor = 16,
  InvalidCollateralAmount = 17,
  InvalidAmount = 18,
  LtvExceedsThreshold = 19,
  OfferNotFound = 20,
  OfferNotDraft = 21,
  OfferNotFunded = 22,
  OfferNotActive = 23,
  OfferAlreadyCancelled = 24,
  OfferAlreadyExpired = 25,
  OfferMatched = 26,
  InsufficientLockedFunds = 27,
  VaultNotConfigured = 30,
  LoanManagerNotConfigured = 31,
  MarketplaceNotConfigured = 32,
  Overflow = 40,
}

pub const BPS_DENOMINATOR: u128 = 10_000;
pub const SAFE_HEALTH_FACTOR_BPS: u32 = 14_000;
pub const LIQUIDATION_HEALTH_FACTOR_BPS: u32 = 12_000;
pub const CLOSE_FACTOR_BPS: u32 = 5_000;
pub const DEFAULT_LIQUIDATION_BONUS_BPS: u32 = 500;
