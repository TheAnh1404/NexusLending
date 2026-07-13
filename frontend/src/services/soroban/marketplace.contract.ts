import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { CONTRACTS, resolveAssetContractId, STELLAR_DECIMALS } from './config';
import { buildAndSubmitTx } from './transaction';
import type { TxStage } from './transaction';
import type { CreateOfferInput } from '../offers/offers.service';
import { MAX_FIXED_APR_PERCENT } from '../../utils/finance';

/**
 * Convert a human-readable token amount to raw contract units (i128 ScVal).
 * Stellar classic assets use 7 decimals by default.
 */
const toContractAmount = (amount: number, decimals: number = STELLAR_DECIMALS): xdr.ScVal =>
  nativeToScVal(BigInt(Math.round(amount * 10 ** decimals)), { type: 'i128' });

/**
 * Convert a JS number to a Soroban u32 ScVal.
 * Used for BPS values, day counts, and other u32 contract parameters.
 */
const toU32 = (value: number): xdr.ScVal =>
  nativeToScVal(value, { type: 'u32' });

/**
 * Convert a JS number or bigint to a Soroban u64 ScVal.
 * Used for offer IDs and other u64 contract parameters.
 */
const toU64 = (value: number | bigint | string): xdr.ScVal =>
  nativeToScVal(BigInt(value), { type: 'u64' });

export const marketplaceContract = {
  async createOfferTx(input: CreateOfferInput, wallet: string, onStage?: (stage: TxStage) => void) {
    // Pre-validate before building the transaction to show clear errors
    if (input.amount <= 0) throw new Error('Loan amount must be greater than 0.');
    if (input.apr <= 0) throw new Error('APR must be greater than 0%.');
    if (input.apr > MAX_FIXED_APR_PERCENT) {
      throw new Error(`APR cannot exceed ${MAX_FIXED_APR_PERCENT}% per year.`);
    }
    if (input.duration <= 0) throw new Error('Duration must be at least 1 day.');
    if (input.maxLTV <= 0) throw new Error('Max LTV must be greater than 0%.');
    if (input.maxLTV > input.liquidationThreshold) {
      throw new Error('Max LTV must be less than or equal to the Liquidation Threshold.');
    }
    if (input.liquidationThreshold <= 0 || input.liquidationThreshold > 100) {
      throw new Error('Liquidation Threshold must be between 0% and 100%.');
    }
    if (input.liquidationBonus < 0 || input.liquidationBonus > 50) {
      throw new Error('Liquidation Bonus must be between 0% and 50%.');
    }
    if (input.minHealthFactor > 0 && input.minHealthFactor < 1.4) {
      throw new Error('Min Health Factor must be at least 1.4 (14000 bps).');
    }

    const loanAssetContract = resolveAssetContractId(input.asset);
    const collateralAssetContract = resolveAssetContractId(input.collateralAsset);

    // Build args matching the exact Rust function signature:
    // create_offer(env, lender: Address, loan_asset: Address, loan_amount: i128,
    //   fixed_apr_bps: u32, duration_days: u32, collateral_asset: Address,
    //   max_ltv_bps: u32, liquidation_threshold_bps: u32, liquidation_bonus_bps: u32,
    //   grace_period_days: u32, min_health_factor_bps: u32) -> Result<u64, ContractError>
    const args = [
      Address.fromString(wallet).toScVal(),                         // lender: Address
      Address.fromString(loanAssetContract).toScVal(),              // loan_asset: Address
      toContractAmount(input.amount),                               // loan_amount: i128
      toU32(Math.round(input.apr * 100)),                           // fixed_apr_bps: u32
      toU32(input.duration),                                        // duration_days: u32
      Address.fromString(collateralAssetContract).toScVal(),        // collateral_asset: Address
      toU32(Math.round(input.maxLTV * 100)),                        // max_ltv_bps: u32
      toU32(Math.round(input.liquidationThreshold * 100)),          // liquidation_threshold_bps: u32
      toU32(Math.round(input.liquidationBonus * 100)),              // liquidation_bonus_bps: u32
      toU32(input.gracePeriod),                                     // grace_period_days: u32
      toU32(Math.round(input.minHealthFactor * 10000)),             // min_health_factor_bps: u32
    ];
    return buildAndSubmitTx(CONTRACTS.marketplace, 'create_offer', args, wallet, onStage);
  },

  async fundOfferTx(contractOfferId: string | number | bigint, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [toU64(contractOfferId)];
    return buildAndSubmitTx(CONTRACTS.marketplace, 'fund_offer', args, wallet, onStage);
  },

  async activateOfferTx(contractOfferId: string | number | bigint, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [toU64(contractOfferId)];
    return buildAndSubmitTx(CONTRACTS.marketplace, 'activate_offer', args, wallet, onStage);
  },

  async cancelOfferTx(contractOfferId: string | number | bigint, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [toU64(contractOfferId)];
    return buildAndSubmitTx(CONTRACTS.marketplace, 'cancel_offer', args, wallet, onStage);
  },

  async acceptOfferTx(
    contractOfferId: string | number | bigint,
    borrower: string,
    collateralAmount: number,
    wallet: string,
    onStage?: (stage: TxStage) => void
  ) {
    const args = [
      toU64(contractOfferId),                                       // offer_id: u64
      Address.fromString(borrower).toScVal(),                       // borrower: Address
      toContractAmount(collateralAmount),                            // collateral_amount: i128
    ];
    return buildAndSubmitTx(CONTRACTS.marketplace, 'accept_offer', args, wallet, onStage);
  },
};
