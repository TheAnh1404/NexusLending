import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { CONTRACTS, STELLAR_DECIMALS } from './config';
import { buildAndSubmitTx, readContractValue } from './transaction';
import type { TxStage } from './transaction';
import { decimalToScaledBigInt } from './amounts';

/** Convert a JS number/bigint to a Soroban u64 ScVal. */
const toU64 = (value: number | bigint | string): ReturnType<typeof nativeToScVal> =>
  nativeToScVal(BigInt(value), { type: 'u64' });

/** Convert a human-readable token amount to raw contract units (i128 ScVal). */
const toContractAmount = (amount: number, decimals: number = STELLAR_DECIMALS): ReturnType<typeof nativeToScVal> =>
  nativeToScVal(decimalToScaledBigInt(amount, decimals), { type: 'i128' });

const enumVariantName = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
};

export const loanManagerContract = {
  async getLoanStatus(contractLoanId: string | number | bigint, sourceWallet: string): Promise<string | null> {
    const loan = await readContractValue(CONTRACTS.loanManager, 'get_loan', [toU64(contractLoanId)], sourceWallet);
    return enumVariantName((loan as { status?: unknown } | undefined)?.status);
  },

  async activateLoanTx(contractLoanId: string | number | bigint, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [toU64(contractLoanId)];
    return buildAndSubmitTx(CONTRACTS.loanManager, 'activate_loan', args, wallet, onStage);
  },

  async addCollateralTx(contractLoanId: string | number | bigint, amount: number, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [
      toU64(contractLoanId),
      toContractAmount(amount),
    ];
    return buildAndSubmitTx(CONTRACTS.loanManager, 'add_collateral', args, wallet, onStage);
  },

  async partialRepayTx(contractLoanId: string | number | bigint, amount: number, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [
      toU64(contractLoanId),
      toContractAmount(amount),
    ];
    return buildAndSubmitTx(CONTRACTS.loanManager, 'partial_repay', args, wallet, onStage);
  },

  async fullRepayTx(contractLoanId: string | number | bigint, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [toU64(contractLoanId)];
    return buildAndSubmitTx(CONTRACTS.loanManager, 'full_repay', args, wallet, onStage);
  },

  async markExpiredTx(contractLoanId: string | number | bigint, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [toU64(contractLoanId)];
    return buildAndSubmitTx(CONTRACTS.loanManager, 'mark_expired', args, wallet, onStage);
  },

  async markDefaultedTx(contractLoanId: string | number | bigint, wallet: string, onStage?: (stage: TxStage) => void) {
    const args = [toU64(contractLoanId)];
    return buildAndSubmitTx(CONTRACTS.loanManager, 'mark_defaulted', args, wallet, onStage);
  },

  async liquidateTx(
    contractLoanId: string | number | bigint,
    liquidator: string,
    repayAmount: number,
    wallet: string,
    onStage?: (stage: TxStage) => void
  ) {
    const args = [
      toU64(contractLoanId),
      Address.fromString(liquidator).toScVal(),
      toContractAmount(repayAmount),
    ];
    return buildAndSubmitTx(CONTRACTS.loanManager, 'liquidate', args, wallet, onStage);
  },
};
