import type { TxResult } from '../../services/soroban/transaction';

export const confirmedTransactionNotification = (txRes: TxResult) => ({
  message: 'Transaction Confirmed',
  description: <a href={txRes.explorerUrl} target="_blank" rel="noreferrer">View on Stellar Expert</a>,
});
