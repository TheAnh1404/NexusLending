import { Prisma } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { eventVerifierService, EventVerifierService } from './event-verifier.service';
import { explorerService, ExplorerService } from './explorer.service';
import { transactionVerifierService, TransactionVerifierService } from './transaction-verifier.service';
import { VerificationError } from './verification.errors';
import type {
  NormalizedEvent,
  VerificationRequest,
  VerificationTransactionInput,
  VerifiedTransaction,
} from './verification.types';

const txHashPattern = /^[a-fA-F0-9]{64}$/;

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

export class VerificationService {
  constructor(
    private readonly transactions: TransactionVerifierService = transactionVerifierService,
    private readonly events: EventVerifierService = eventVerifierService,
    private readonly explorer: ExplorerService = explorerService,
  ) {}

  async verifyAction(request: VerificationRequest): Promise<VerifiedTransaction> {
    if (!txHashPattern.test(request.txHash)) {
      throw new VerificationError('txHash must be a 64-character Stellar transaction hash');
    }

    const transaction = await this.transactions.verifyTransaction(request.txHash);
    const normalizedEvents = await this.transactions.getTransactionEvents(transaction);
    const event = this.events.verify(request, normalizedEvents);

    const existing = await prisma.indexedEvent.findUnique({
      where: {
        txHash_eventIndex: {
          txHash: event.txHash,
          eventIndex: event.eventIndex,
        },
      },
    });

    return {
      action: request.action,
      transaction,
      event,
      explorerUrl: this.explorer.getTransactionUrl(request.txHash),
      contractId: event.contractId,
      actor: event.actor,
      offerId: event.offerId,
      loanId: event.loanId,
      amount: event.amount,
      asset: event.asset,
      eventName: event.eventName,
      entityType: event.entityType,
      entityId: event.entityId,
      alreadyProcessed: Boolean(existing),
    };
  }

  async markEventProcessed(event: NormalizedEvent): Promise<void> {
    await prisma.indexedEvent.upsert({
      where: {
        txHash_eventIndex: {
          txHash: event.txHash,
          eventIndex: event.eventIndex,
        },
      },
      create: {
        txHash: event.txHash,
        eventIndex: event.eventIndex,
        ledger: event.ledger,
        contractId: event.contractId,
        eventName: event.eventName,
        actor: event.actor,
        entityType: event.entityType,
        entityId: event.entityId,
        amount: event.amount,
        asset: event.asset,
        network: event.network,
        explorerUrl: event.explorerUrl,
        payload: event.payload,
      },
      update: {
        processedAt: new Date(),
      },
    });
  }

  toReceipt(verified: VerifiedTransaction): VerificationTransactionInput {
    return {
      txHash: verified.transaction.txHash,
      explorerUrl: verified.explorerUrl,
      ledger: verified.transaction.ledger,
      txStatus: verified.transaction.status,
      contractId: verified.contractId,
      blockTimestamp: verified.transaction.confirmedAt,
    };
  }

  amountOrThrow(verified: VerifiedTransaction, fallback?: Prisma.Decimal.Value): Prisma.Decimal {
    if (verified.amount) return verified.amount;
    if (fallback !== undefined) return decimal(fallback);
    throw new VerificationError(`Verified event ${verified.eventName} did not include an amount`);
  }
}

export const verificationService = new VerificationService();

