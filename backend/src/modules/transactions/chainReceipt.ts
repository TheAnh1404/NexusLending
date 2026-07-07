import { Prisma, TransactionType } from '@prisma/client';

import { ApiError } from '../../utils/apiError';

export interface ConfirmedChainReceiptInput {
  txHash?: string;
  explorerUrl?: string;
  ledger?: number;
  status?: string;
  txStatus?: string;
  contractId?: string;
  blockTimestamp?: Date;
  contractReturnValue?: unknown;
}

export interface ConfirmedChainReceipt {
  txHash: string;
  explorerUrl: string;
  ledger: number;
  status: 'SUCCESS';
  contractId?: string;
  blockTimestamp: Date;
  contractReturnValue?: unknown;
}

interface LedgerTransactionInput {
  offerId?: string | null;
  loanId?: string;
  asset?: string;
  amount?: Prisma.Decimal.Value;
  details: string;
  receipt: ConfirmedChainReceiptInput;
  metadata?: Prisma.InputJsonValue;
}

const TX_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

export const requireConfirmedReceipt = (
  input: ConfirmedChainReceiptInput | undefined
): ConfirmedChainReceipt => {
  if (!input?.txHash) {
    throw new ApiError(400, 'txHash is required after confirmed Soroban transaction');
  }
  if (!TX_HASH_PATTERN.test(input.txHash)) {
    throw new ApiError(400, 'txHash must be a 64-character Stellar transaction hash');
  }
  if (!input.explorerUrl) {
    throw new ApiError(400, 'explorerUrl is required after confirmed Soroban transaction');
  }
  if (
    !input.explorerUrl.startsWith('https://stellar.expert/explorer/') ||
    !input.explorerUrl.endsWith(`/tx/${input.txHash}`)
  ) {
    throw new ApiError(400, 'explorerUrl must be a Stellar Expert transaction URL for txHash');
  }
  if (!input.ledger || input.ledger <= 0 || !Number.isInteger(input.ledger)) {
    throw new ApiError(400, 'ledger is required after confirmed Soroban transaction');
  }
  const status = input.txStatus ?? input.status;
  if (status !== 'SUCCESS') {
    throw new ApiError(400, 'Only SUCCESS Soroban transactions can be persisted');
  }

  return {
    txHash: input.txHash,
    explorerUrl: input.explorerUrl,
    ledger: input.ledger,
    status: 'SUCCESS',
    contractId: input.contractId,
    blockTimestamp: input.blockTimestamp ?? new Date(),
    contractReturnValue: input.contractReturnValue
  };
};

export const createLedgerTransaction = (
  type: TransactionType,
  wallet: string,
  input: LedgerTransactionInput
): Prisma.TransactionUncheckedCreateInput => {
  const receipt = requireConfirmedReceipt(input.receipt);

  return {
    txHash: receipt.txHash,
    explorerUrl: receipt.explorerUrl,
    contract: receipt.contractId,
    ledger: receipt.ledger,
    type,
    wallet,
    offerId: input.offerId ?? undefined,
    loanId: input.loanId,
    asset: input.asset,
    amount: input.amount === undefined ? undefined : decimal(input.amount),
    status: receipt.status,
    blockTimestamp: receipt.blockTimestamp,
    metadata: {
      details: input.details,
      ...(receipt.contractReturnValue === undefined
        ? {}
        : { contractReturnValue: receipt.contractReturnValue as Prisma.InputJsonValue }),
      ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})
    }
  };
};
