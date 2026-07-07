import { Contract, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
import { CONTRACTS, STELLAR_DECIMALS } from './config';
import { sorobanRpc } from './client';

/** Convert a JS number/bigint to a Soroban u64 ScVal. */
const toU64 = (value: number | bigint | string): ReturnType<typeof nativeToScVal> =>
  nativeToScVal(BigInt(value), { type: 'u64' });

/** Convert raw contract units back to a human-readable amount. */
const fromContractAmount = (raw: number | bigint, decimals: number = STELLAR_DECIMALS): number =>
  Number(raw) / 10 ** decimals;

export const vaultContract = {
  async getOfferLockedAmount(offerId: string | number | bigint): Promise<number> {
    // Read-only query simulation
    const scValOfferId = toU64(offerId);
    const simulated = await sorobanRpc.simulateTransaction(
      new Contract(CONTRACTS.vault).call('get_offer_locked_amount', scValOfferId) as any
    );
    if (simulated && 'result' in simulated && simulated.result) {
      return fromContractAmount(scValToNative(simulated.result.retval));
    }
    return 0;
  },

  async getLoanCollateralAmount(loanId: string | number | bigint): Promise<number> {
    const scValLoanId = toU64(loanId);
    const simulated = await sorobanRpc.simulateTransaction(
      new Contract(CONTRACTS.vault).call('get_loan_collateral_amount', scValLoanId) as any
    );
    if (simulated && 'result' in simulated && simulated.result) {
      return fromContractAmount(scValToNative(simulated.result.retval));
    }
    return 0;
  },
};
