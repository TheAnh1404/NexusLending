import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { CONTRACTS, resolveAssetContractId, STELLAR_DECIMALS } from './config';
import { buildAndSubmitTx, readContractValue } from './transaction';
import type { TxStage } from './transaction';
import type { CreateOfferInput } from '../offers/offers.service';
import { MAX_FIXED_APR_PERCENT } from '../../utils/finance';
import { decimalToScaledBigInt } from './amounts';

/**
 * Convert a human-readable token amount to raw contract units (i128 ScVal).
 * Stellar classic assets use 7 decimals by default.
 */
const toContractAmount = (amount: number, decimals: number = STELLAR_DECIMALS): xdr.ScVal =>
  nativeToScVal(decimalToScaledBigInt(amount, decimals), { type: 'i128' });

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

const enumVariantName = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
};

/**
 * Safely convert a percentage, ratio, or BPS number into raw BPS (1% = 100 bps, 100% = 10000 bps).
 * Handles all representations robustly:
 * - BPS already (e.g. 7500 -> 7500)
 * - Decimal ratio (e.g. 0.75 -> 7500)
 * - Percentage (e.g. 75 -> 7500)
 */
export const toBpsValue = (val: number): number => {
  const numeric = Number(val);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric > 100) return Math.round(numeric); // Already BPS (e.g. 7500)
  if (numeric <= 1) return Math.round(numeric * 10000); // Decimal ratio (e.g. 0.75 -> 7500)
  return Math.round(numeric * 100); // Percentage (e.g. 75 -> 7500)
};

/**
 * Safely convert Health Factor into BPS (e.g. 1.4 -> 14000).
 */
export const toHfBpsValue = (val: number): number => {
  const numeric = Number(val);
  if (!Number.isFinite(numeric) || numeric <= 0) return 14000;
  if (numeric >= 100) return Math.round(numeric); // Already BPS (e.g. 14000)
  return Math.round(numeric * 10000); // Ratio (e.g. 1.4 -> 14000)
};

const riskInputDetails = (
  input: CreateOfferInput,
  values: { maxLtvBps: number; liqThreshBps: number; liqBonusBps: number; minHfBps: number }
): string =>
  `raw maxLTV=${input.maxLTV}, threshold=${input.liquidationThreshold}, bonus=${input.liquidationBonus}, minHF=${input.minHealthFactor}; `
  + `normalized maxLTV=${values.maxLtvBps}bps, threshold=${values.liqThreshBps}bps, bonus=${values.liqBonusBps}bps, minHF=${values.minHfBps}bps`;

export const marketplaceContract = {
  async getOfferStatus(contractOfferId: string | number | bigint, sourceWallet: string): Promise<string | null> {
    const offer = await readContractValue(CONTRACTS.marketplace, 'get_offer', [toU64(contractOfferId)], sourceWallet);
    return enumVariantName((offer as { status?: unknown } | undefined)?.status);
  },

  async createOfferTx(input: CreateOfferInput, wallet: string, onStage?: (stage: TxStage) => void) {
    const aprBps = toBpsValue(input.apr);
    const maxLtvBps = toBpsValue(input.maxLTV);
    const liqThreshBps = toBpsValue(input.liquidationThreshold);
    const liqBonusBps = toBpsValue(input.liquidationBonus);
    const minHfBps = toHfBpsValue(input.minHealthFactor);

    // Pre-validate before building the transaction to show clear errors
    if (input.amount <= 0) throw new Error('Loan amount must be greater than 0.');
    if (aprBps <= 0) throw new Error('APR must be greater than 0%.');
    if (aprBps > MAX_FIXED_APR_PERCENT * 100) {
      throw new Error(`APR cannot exceed ${MAX_FIXED_APR_PERCENT}% per year.`);
    }
    if (input.duration <= 0) throw new Error('Duration must be at least 1 day.');
    const riskDetails = riskInputDetails(input, { maxLtvBps, liqThreshBps, liqBonusBps, minHfBps });

    if (maxLtvBps <= 0 || maxLtvBps > 10000) {
      throw new Error(`Invalid max LTV before simulation (${riskDetails}). Use 1-100%, 0.01-1 ratio, or 100-10000 bps.`);
    }
    if (maxLtvBps > liqThreshBps) {
      throw new Error('Max LTV must be less than or equal to the Liquidation Threshold.');
    }
    if (liqThreshBps <= 0 || liqThreshBps > 10000) {
      throw new Error('Liquidation Threshold must be between 0% and 100%.');
    }
    if (liqBonusBps < 0 || liqBonusBps > 5000) {
      throw new Error('Liquidation Bonus must be between 0% and 50%.');
    }
    if (minHfBps > 0 && minHfBps < 14000) {
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
      toU32(aprBps),                                                // fixed_apr_bps: u32
      toU32(input.duration),                                        // duration_days: u32
      Address.fromString(collateralAssetContract).toScVal(),        // collateral_asset: Address
      toU32(maxLtvBps),                                             // max_ltv_bps: u32
      toU32(liqThreshBps),                                          // liquidation_threshold_bps: u32
      toU32(liqBonusBps),                                           // liquidation_bonus_bps: u32
      toU32(input.gracePeriod),                                     // grace_period_days: u32
      toU32(minHfBps),                                              // min_health_factor_bps: u32
    ];
    if (import.meta.env.DEV) {
      console.debug('[Soroban] create_offer risk params', riskDetails);
    }

    try {
      return await buildAndSubmitTx(CONTRACTS.marketplace, 'create_offer', args, wallet, onStage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Invalid max LTV')) {
        throw new Error(`${message} (${riskDetails})`);
      }
      throw error;
    }
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
