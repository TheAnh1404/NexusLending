import { Prisma, TransactionType } from '@prisma/client';

import { ApiError } from '../../utils/apiError';
import { explorerService } from '../verification/explorer.service';
import type { LedgerTransactionInput, VerifiedTransaction } from '../verification/verification.types';

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

const TX_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const isVerifiedTransaction = (
  receipt: ConfirmedChainReceiptInput | VerifiedTransaction
): receipt is VerifiedTransaction => 'transaction' in receipt && 'event' in receipt;

export const requireConfirmedReceipt = (
  input: ConfirmedChainReceiptInput | VerifiedTransaction | undefined
): ConfirmedChainReceipt => {
  if (input && isVerifiedTransaction(input)) {
    return {
      txHash: input.transaction.txHash,
      explorerUrl: explorerService.getTransactionUrl(input.transaction.txHash),
      ledger: input.transaction.ledger,
      status: input.transaction.status,
      contractId: input.contractId,
      blockTimestamp: input.transaction.confirmedAt,
    };
  }

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
    explorerUrl: explorerService.getTransactionUrl(input.txHash),
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
  const verified = isVerifiedTransaction(input.receipt) ? input.receipt : undefined;
  const event = verified?.event;
  const actor = input.actor ?? verified?.actor;
  const entityType = input.entityType ?? verified?.entityType;
  const entityId = input.entityId ?? verified?.entityId;
  const eventName = input.eventName ?? verified?.eventName;
  const network = input.network ?? verified?.transaction.network;

  return {
    txHash: receipt.txHash,
    explorerUrl: receipt.explorerUrl,
    contract: receipt.contractId,
    contractId: receipt.contractId,
    ledger: receipt.ledger,
    type,
    wallet: actor ?? wallet,
    offerId: input.offerId ?? undefined,
    loanId: input.loanId,
    asset: input.asset,
    amount: input.amount === undefined ? undefined : decimal(input.amount),
    status: receipt.status,
    eventName,
    actor,
    entityType,
    entityId,
    network,
    confirmedAt: receipt.blockTimestamp,
    blockTimestamp: receipt.blockTimestamp,
    metadata: {
      details: input.details,
      eventIndex: event?.eventIndex,
      ...(receipt.contractReturnValue === undefined
        ? {}
        : { contractReturnValue: receipt.contractReturnValue as Prisma.InputJsonValue }),
      ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {})
    }
  };
};
