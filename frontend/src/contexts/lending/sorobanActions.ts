import type { ConfirmedChainReceiptPayload } from '../../services/api/client';
import type { TxResult, TxStage } from '../../services/soroban/transaction';

export const txStageLabels: Record<TxStage, string> = {
  preparing: 'Preparing Transaction...',
  wallet: 'Waiting for Wallet Signature...',
  submitting: 'Submitting Transaction...',
  confirming: 'Waiting for Blockchain Confirmation...',
  confirmed: 'Transaction Confirmed',
};

export const txReceiptFromResult = (txRes: TxResult): ConfirmedChainReceiptPayload => ({
  txHash: txRes.txHash,
  explorerUrl: txRes.explorerUrl,
  ledger: txRes.ledger,
  txStatus: txRes.status,
  contractId: txRes.contractId,
  blockTimestamp: txRes.blockTimestamp,
  contractReturnValue: txRes.contractReturnValue,
});

export const contractReturnId = (txRes: TxResult, label: string): bigint => {
  if (txRes.contractReturnValue === undefined || txRes.contractReturnValue === null) {
    throw new Error(`${label} was not returned by the Soroban contract.`);
  }
  return BigInt(String(txRes.contractReturnValue));
};
