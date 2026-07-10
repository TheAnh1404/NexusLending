import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../../prisma/client';
import { VerificationService } from './verification.service';
import type { NormalizedEvent, RpcTransaction } from './verification.types';

const txHash = 'c'.repeat(64);

const event: NormalizedEvent = {
  contractId: 'C_MARKET',
  ledger: 50,
  txHash,
  eventIndex: 3,
  eventName: 'offer_activated',
  offerId: '5',
  timestamp: new Date('2026-07-10T00:00:00.000Z'),
  entityType: 'offer',
  entityId: '5',
  network: 'testnet',
  explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`,
  payload: {},
};

const transaction: RpcTransaction = {
  txHash,
  ledger: 50,
  status: 'SUCCESS',
  network: 'testnet',
  confirmedAt: new Date('2026-07-10T00:00:00.000Z'),
  raw: {},
};

test('VerificationService marks already indexed events as replayed/idempotent', async () => {
  const original = prisma.indexedEvent.findUnique;
  (prisma.indexedEvent.findUnique as unknown) = async () => ({ id: 'processed' });

  try {
    const service = new VerificationService(
      {
        verifyTransaction: async () => transaction,
        getTransactionEvents: async () => [event],
      } as never,
      {
        verify: () => event,
        getExpectedEvents: () => ['offer_activated'],
      } as never
    );

    const verified = await service.verifyAction({
      action: 'activate_offer',
      txHash,
      expectedContractId: 'C_MARKET',
      expectedOfferId: '5',
    });

    assert.equal(verified.alreadyProcessed, true);
    assert.equal(verified.eventName, 'offer_activated');
  } finally {
    (prisma.indexedEvent.findUnique as unknown) = original;
  }
});
