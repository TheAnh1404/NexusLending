import { rpc } from '@stellar/stellar-sdk';
import { Prisma } from '@prisma/client';

import { env } from '../../config/env.js';
import { prisma } from '../../prisma/client.js';
import { explorerService } from '../verification/index.js';
import { TransactionVerifierService } from '../verification/transaction-verifier.service.js';
import type { RpcTransaction } from '../verification/verification.types.js';
import { eventSyncService, EventSyncService } from './event-sync.service.js';

interface RpcClient {
  getLatestLedger(): Promise<{ sequence: number }>;
  getEvents(input: unknown): Promise<{ events?: unknown[]; cursor?: string }>;
}

export interface IndexerStatus {
  network: string;
  status: string;
  rpcStatus: string;
  currentLedger: number;
  lastLedger: number;
  pendingEvents: number;
  processedEvents: number;
  failedEvents: number;
  lastError?: string | null;
}

const EVENT_PAGE_LIMIT = 100;

export class IndexerService {
  private isRunning = false;
  private readonly pollIntervalMs: number;
  private readonly rpcClient: RpcClient;
  private readonly parser: TransactionVerifierService;

  constructor(
    rpcClient?: RpcClient,
    private readonly sync: EventSyncService = eventSyncService,
    pollIntervalMs = 10_000
  ) {
    this.rpcClient = rpcClient ?? new rpc.Server(env.stellarRpcUrl || 'https://soroban-testnet.stellar.org:443') as unknown as RpcClient;
    this.parser = new TransactionVerifierService(this.rpcClient as never, explorerService, env.stellarNetwork);
    this.pollIntervalMs = pollIntervalMs;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.updateCheckpoint({ status: 'running', rpcStatus: 'starting' }).catch((error) => {
      console.error('Failed to initialize indexer checkpoint', error);
    });
    void this.pollLoop();
  }

  stop(): void {
    this.isRunning = false;
    void this.updateCheckpoint({ status: 'stopped' }).catch((error) => {
      console.error('Failed to stop indexer checkpoint', error);
    });
  }

  async getStatus(): Promise<IndexerStatus> {
    const checkpoint = await this.getCheckpoint();
    return {
      network: checkpoint.network,
      status: checkpoint.status,
      rpcStatus: checkpoint.rpcStatus,
      currentLedger: checkpoint.currentLedger,
      lastLedger: checkpoint.lastLedger,
      pendingEvents: checkpoint.pendingEvents,
      processedEvents: checkpoint.processedEvents,
      failedEvents: checkpoint.failedEvents,
      lastError: checkpoint.lastError,
    };
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.pollOnce();
      } catch (error) {
        await this.updateCheckpoint({
          rpcStatus: 'error',
          status: 'running',
          lastError: error instanceof Error ? error.message : 'Unknown indexer error',
        });
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  async pollOnce(): Promise<void> {
    const checkpoint = await this.getCheckpoint();
    const latestLedger = (await this.rpcClient.getLatestLedger()).sequence;
    const startLedger = checkpoint.lastLedger > 0
      ? checkpoint.lastLedger + 1
      : Math.max(1, latestLedger - 100);

    if (startLedger > latestLedger) {
      await this.updateCheckpoint({
        currentLedger: latestLedger,
        rpcStatus: 'ok',
        pendingEvents: 0,
      });
      return;
    }

    const contractIds = [
      env.marketplaceContractId,
      env.loanManagerContractId,
      env.oracleContractId,
      env.vaultContractId,
    ].filter(Boolean);

    const rawEvents: unknown[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.rpcClient.getEvents({
        startLedger,
        endLedger: latestLedger,
        filters: [{ type: 'contract', contractIds }],
        limit: EVENT_PAGE_LIMIT,
        ...(cursor ? { cursor } : {}),
      });
      rawEvents.push(...(response.events ?? []));
      const nextCursor = response.cursor || undefined;
      if (!nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    } while (cursor);

    let processedEvents = 0;
    let failedEvents = 0;

    for (let index = 0; index < rawEvents.length; index += 1) {
      const raw = rawEvents[index] as Record<string, unknown>;
      const ledger = Number(raw.ledger ?? raw.ledgerSequence ?? latestLedger);
      const txHash = String(raw.txHash ?? raw.transactionHash ?? '');
      if (!txHash) continue;

      const transaction: RpcTransaction = {
        txHash,
        ledger,
        status: 'SUCCESS',
        network: env.stellarNetwork,
        confirmedAt: new Date(),
        raw,
      };

      const event = this.parser.normalizeEvent(raw, transaction, index);
      if (!event) continue;

      try {
        const result = await this.sync.sync(event);
        if (result === 'processed') processedEvents += 1;
      } catch (error) {
        failedEvents += 1;
        await this.updateCheckpoint({
          lastError: error instanceof Error ? error.message : 'Failed to process indexed event',
        });
      }
    }

    await this.updateCheckpoint({
      status: 'running',
      rpcStatus: 'ok',
      currentLedger: latestLedger,
      lastLedger: latestLedger,
      pendingEvents: 0,
      processedEvents: { increment: processedEvents },
      failedEvents: { increment: failedEvents },
      ...(failedEvents === 0 ? { lastError: null } : {}),
    });
  }

  private async getCheckpoint() {
    const checkpoint = await prisma.indexerCheckpoint.findUnique({
      where: { network: env.stellarNetwork },
    });
    if (checkpoint) return checkpoint;

    try {
      return await prisma.indexerCheckpoint.create({
        data: {
          network: env.stellarNetwork,
          status: this.isRunning ? 'running' : 'stopped',
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await prisma.indexerCheckpoint.findUnique({
          where: { network: env.stellarNetwork },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async updateCheckpoint(data: Prisma.IndexerCheckpointUpdateInput): Promise<void> {
    await prisma.indexerCheckpoint.upsert({
      where: { network: env.stellarNetwork },
      create: createCheckpointData(data, this.isRunning),
      update: data,
    });
  }
}

export const indexerService = new IndexerService();

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === 'P2002';
}

function createCheckpointData(
  data: Prisma.IndexerCheckpointUpdateInput,
  isRunning: boolean
): Prisma.IndexerCheckpointCreateInput {
  return {
    network: env.stellarNetwork,
    status: stringValue(data.status) ?? (isRunning ? 'running' : 'stopped'),
    rpcStatus: stringValue(data.rpcStatus) ?? 'unknown',
    lastLedger: numberValue(data.lastLedger) ?? 0,
    currentLedger: numberValue(data.currentLedger) ?? 0,
    pendingEvents: numberValue(data.pendingEvents) ?? 0,
    processedEvents: numberValue(data.processedEvents) ?? 0,
    failedEvents: numberValue(data.failedEvents) ?? 0,
    lastError: nullableStringValue(data.lastError),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function nullableStringValue(value: unknown): string | null | undefined {
  return value === null || typeof value === 'string' ? value : undefined;
}
