import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { CONTRACTS, STELLAR_DECIMALS } from './config';
import { buildAndSubmitTx } from './transaction';
import type { TxStage } from './transaction';

/** Convert a JS number/bigint to a Soroban u64 ScVal. */
const toU64 = (value: number | bigint | string): ReturnType<typeof nativeToScVal> =>
  nativeToScVal(BigInt(value), { type: 'u64' });

/** Convert a human-readable token amount to raw contract units (i128 ScVal). */
const toContractAmount = (amount: number, decimals: number = STELLAR_DECIMALS): ReturnType<typeof nativeToScVal> =>
  nativeToScVal(BigInt(Math.round(amount * 10 ** decimals)), { type: 'i128' });

export const loanManagerContract = {
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
