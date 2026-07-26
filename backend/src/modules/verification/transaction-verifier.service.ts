import { rpc, scValToNative } from '@stellar/stellar-sdk';
import { Prisma } from '@prisma/client';

import {
  env,
  normalizeStellarNetworkName,
  passphraseForNetwork,
  type StellarNetworkName,
} from '../../config/env.js';
import { explorerService, ExplorerService } from './explorer.service.js';
import {
  TransactionNotFoundError,
  TransactionNotSuccessfulError,
  WrongNetworkError,
} from './verification.errors.js';
import type { EntityType, NormalizedEvent, RpcTransaction } from './verification.types.js';

interface RpcClient {
  getLatestLedger(): Promise<{ sequence: number }>;
  getTransaction(txHash: string): Promise<unknown>;
  getEvents(input: unknown): Promise<{ events?: unknown[]; cursor?: string }>;
  getNetwork?(): Promise<{ passphrase?: string; networkPassphrase?: string }>;
}

const txHashPattern = /^[a-fA-F0-9]{64}$/;
const CONTRACT_DECIMALS = 7;
const EVENT_PAGE_LIMIT = 100;

const networkFromPassphrase = (passphrase: string): StellarNetworkName | undefined => {
  const knownNetworks: StellarNetworkName[] = ['testnet', 'public', 'futurenet', 'standalone'];
  return knownNetworks.find((network) => passphraseForNetwork(network) === passphrase);
};

const toDecimal = (value: unknown): Prisma.Decimal | undefined => {
  if (value === undefined || value === null) return undefined;
  const scale = new Prisma.Decimal(10).pow(CONTRACT_DECIMALS);
  if (typeof value === 'bigint') {
    return new Prisma.Decimal(value.toString()).div(scale).toDecimalPlaces(CONTRACT_DECIMALS);
  }
  if (typeof value === 'number' || typeof value === 'string') {
    try {
      return new Prisma.Decimal(value).div(scale).toDecimalPlaces(CONTRACT_DECIMALS);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const toStringId = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return undefined;
};

const jsonSafe = (value: unknown): Prisma.InputJsonValue => {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return value.toString();
  if (value === undefined) return '__undefined__';
  if (Array.isArray(value)) return value.map(jsonSafe) as Prisma.InputJsonArray;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, jsonSafe(item)])
    ) as Prisma.InputJsonObject;
  }
  return value as Prisma.InputJsonValue;
};

const nativeFromScVal = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  try {
    return scValToNative(value as never);
  } catch {
    return value;
  }
};

const getEventName = (topics: unknown[]): string => {
  const native = nativeFromScVal(topics[0]);
  return typeof native === 'string' ? native : String(native ?? 'unknown');
};

const eventEntityType = (eventName: string): EntityType => {
  if (eventName.startsWith('offer_')) return 'offer';
  if (eventName.startsWith('loan_') || eventName === 'collateral_added' || eventName === 'partial_repaid') {
    return 'loan';
  }
  if (eventName === 'price_updated') return 'oracle';
  if (
    eventName.includes('collateral') ||
    eventName.includes('repayment') ||
    eventName.includes('lender_funds') ||
    eventName === 'loan_asset_transferred'
  ) {
    return 'vault';
  }
  return 'unknown';
};

const eventContractId = (event: Record<string, unknown>): string =>
  String(event.contractId ?? event.contract ?? '');

const eventLedger = (event: Record<string, unknown>, fallback: number): number =>
  Number(event.ledger ?? event.ledgerSequence ?? fallback);

const eventTxHash = (event: Record<string, unknown>, fallback: string): string =>
  String(event.txHash ?? event.transactionHash ?? fallback);

const eventTopics = (event: Record<string, unknown>): unknown[] => {
  const topics = event.topic ?? event.topics;
  return Array.isArray(topics) ? topics : [];
};

const eventValue = (event: Record<string, unknown>): unknown => nativeFromScVal(event.value);

const eventIndexFromId = (event: Record<string, unknown>, fallback: number): number => {
  const id = event.id;
  if (typeof id === 'string') {
    const numericParts = id.match(/\d+/g);
    const last = numericParts?.[numericParts.length - 1];
    if (last) {
      const parsed = Number(last);
      if (Number.isInteger(parsed)) return parsed;
    }
  }
  return fallback;
};

const normalizeOfferEvent = (
  eventName: string,
  topicValues: unknown[],
  value: unknown
): Pick<NormalizedEvent, 'actor' | 'offerId' | 'loanId' | 'amount' | 'entityId'> => {
  const offerId = toStringId(topicValues[1]);
  if (eventName === 'offer_created') {
    return {
      offerId,
      actor: toStringId(topicValues[2]),
      amount: toDecimal(value),
      entityId: offerId,
    };
  }
  if (eventName === 'offer_matched') {
    return {
      offerId,
      actor: toStringId(topicValues[2]),
      loanId: toStringId(value),
      entityId: offerId,
    };
  }
  return {
    offerId,
    actor: toStringId(topicValues[2]),
    amount: toDecimal(value),
    entityId: offerId,
  };
};

const normalizeLoanEvent = (
  eventName: string,
  topicValues: unknown[],
  value: unknown
): Pick<NormalizedEvent, 'actor' | 'loanId' | 'amount' | 'entityId'> => {
  const loanId = toStringId(topicValues[1]);
  const actor = ['loan_created', 'loan_activated', 'collateral_added', 'partial_repaid', 'loan_repaid', 'loan_liquidated']
    .includes(eventName)
    ? toStringId(topicValues[2])
    : undefined;
  return {
    loanId,
    actor,
    amount: ['loan_created', 'loan_activated', 'collateral_added', 'partial_repaid', 'loan_repaid', 'loan_liquidated']
      .includes(eventName)
      ? toDecimal(value)
      : undefined,
    entityId: loanId,
  };
};

const normalizeOracleEvent = (
  topicValues: unknown[],
  value: unknown
): Pick<NormalizedEvent, 'actor' | 'amount' | 'asset' | 'entityId'> => {
  const assetPairOrBase = toStringId(topicValues[1]);
  const isStringPair = Boolean(assetPairOrBase?.includes('/'));
  const quote = isStringPair ? undefined : toStringId(topicValues[2]);
  const actor = isStringPair ? toStringId(topicValues[2]) : toStringId(topicValues[3]);
  const entityId = quote ? `${assetPairOrBase}/${quote}` : assetPairOrBase;
  return {
    actor,
    amount: toDecimal(value),
    asset: entityId,
    entityId,
  };
};

export class TransactionVerifierService {
  private readonly rpcClient: RpcClient;

  constructor(
    rpcClient?: RpcClient,
    private readonly explorer: ExplorerService = explorerService,
    private readonly network: string = env.stellarNetwork,
  ) {
    this.rpcClient = rpcClient ?? new rpc.Server(env.stellarRpcUrl || 'https://soroban-testnet.stellar.org:443') as unknown as RpcClient;
  }

  async verifyTransaction(txHash: string): Promise<RpcTransaction> {
    if (!txHashPattern.test(txHash)) {
      throw new TransactionNotFoundError(txHash);
    }

    const response = await this.rpcClient.getTransaction(txHash) as Record<string, unknown>;
    const status = String(response.status ?? response.result?.toString?.() ?? '');

    if (!status || status === 'NOT_FOUND') {
      throw new TransactionNotFoundError(txHash);
    }
    if (status !== 'SUCCESS') {
      throw new TransactionNotSuccessfulError(txHash, status);
    }

    const ledger = Number(response.ledger ?? response.ledgerSequence);
    if (!Number.isInteger(ledger) || ledger <= 0) {
      throw new TransactionNotSuccessfulError(txHash, 'SUCCESS_WITHOUT_LEDGER');
    }

    const configuredNetwork = normalizeStellarNetworkName(this.network);
    const expectedNetwork = normalizeStellarNetworkName(env.stellarNetwork);
    if (configuredNetwork !== expectedNetwork) {
      throw new WrongNetworkError(expectedNetwork, configuredNetwork);
    }

    if (this.rpcClient.getNetwork) {
      const rpcNetwork = await this.rpcClient.getNetwork();
      const actualPassphrase = String(rpcNetwork.passphrase ?? rpcNetwork.networkPassphrase ?? '');
      if (actualPassphrase && actualPassphrase !== env.stellarNetworkPassphrase) {
        throw new WrongNetworkError(
          expectedNetwork,
          networkFromPassphrase(actualPassphrase) ?? actualPassphrase
        );
      }
    }

    return {
      txHash,
      ledger,
      status: 'SUCCESS',
      network: expectedNetwork,
      confirmedAt: new Date(),
      raw: jsonSafe(response),
    };
  }

  async getTransactionEvents(transaction: RpcTransaction): Promise<NormalizedEvent[]> {
    const events: unknown[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.rpcClient.getEvents({
        startLedger: transaction.ledger,
        endLedger: transaction.ledger,
        filters: [{ type: 'contract' }],
        limit: EVENT_PAGE_LIMIT,
        ...(cursor ? { cursor } : {}),
      });

      events.push(...(response.events ?? []));
      const nextCursor = response.cursor || undefined;
      if (!nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    } while (cursor);

    return events
      .map((event, index) => this.normalizeEvent(event, transaction, index))
      .filter((event): event is NormalizedEvent => Boolean(event))
      .filter((event) => event.txHash === transaction.txHash);
  }

  normalizeEvent(event: unknown, transaction: RpcTransaction, fallbackIndex: number): NormalizedEvent | null {
    const raw = event as Record<string, unknown>;
    const topics = eventTopics(raw);
    if (topics.length === 0) return null;

    const topicValues = topics.map(nativeFromScVal);
    const eventName = getEventName(topics);
    const entityType = eventEntityType(eventName);
    const value = eventValue(raw);

    let fields: Partial<NormalizedEvent> = {};
    if (entityType === 'offer') {
      fields = normalizeOfferEvent(eventName, topicValues, value);
    } else if (entityType === 'loan') {
      fields = normalizeLoanEvent(eventName, topicValues, value);
    } else if (entityType === 'oracle') {
      fields = normalizeOracleEvent(topicValues, value);
    }

    return {
      contractId: eventContractId(raw),
      ledger: eventLedger(raw, transaction.ledger),
      txHash: eventTxHash(raw, transaction.txHash),
      eventIndex: eventIndexFromId(raw, fallbackIndex),
      eventName,
      actor: fields.actor,
      offerId: fields.offerId,
      loanId: fields.loanId,
      amount: fields.amount,
      asset: fields.asset,
      timestamp: transaction.confirmedAt,
      entityType,
      entityId: fields.entityId,
      network: transaction.network,
      explorerUrl: this.explorer.getTransactionUrl(transaction.txHash),
      payload: jsonSafe({
        topics: topicValues,
        value,
        raw,
      }),
    };
  }
}

export const transactionVerifierService = new TransactionVerifierService();
