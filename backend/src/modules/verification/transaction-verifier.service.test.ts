import test from 'node:test';
import assert from 'node:assert/strict';

import { TransactionVerifierService } from './transaction-verifier.service.js';
import { TransactionNotFoundError, WrongNetworkError } from './verification.errors.js';

const txHash = 'b'.repeat(64);

test('TransactionVerifier rejects fake tx hashes before hitting RPC', async () => {
  const verifier = new TransactionVerifierService({
    getLatestLedger: async () => ({ sequence: 1 }),
    getTransaction: async () => ({ status: 'SUCCESS', ledger: 1 }),
    getEvents: async () => ({ events: [] }),
  });

  await assert.rejects(() => verifier.verifyTransaction('not-a-hash'), TransactionNotFoundError);
});

test('TransactionVerifier rejects wrong configured network', async () => {
  const verifier = new TransactionVerifierService({
    getLatestLedger: async () => ({ sequence: 1 }),
    getTransaction: async () => ({ status: 'SUCCESS', ledger: 1 }),
    getEvents: async () => ({ events: [] }),
  }, undefined, 'mainnet');

  await assert.rejects(() => verifier.verifyTransaction(txHash), WrongNetworkError);
});

test('TransactionVerifier rejects RPC passphrase mismatch', async () => {
  const verifier = new TransactionVerifierService({
    getLatestLedger: async () => ({ sequence: 1 }),
    getTransaction: async () => ({ status: 'SUCCESS', ledger: 1 }),
    getEvents: async () => ({ events: [] }),
    getNetwork: async () => ({ passphrase: 'Public Global Stellar Network ; September 2015' }),
  });

  await assert.rejects(() => verifier.verifyTransaction(txHash), WrongNetworkError);
});

test('TransactionVerifier normalizes Soroban events', () => {
  const verifier = new TransactionVerifierService({
    getLatestLedger: async () => ({ sequence: 1 }),
    getTransaction: async () => ({ status: 'SUCCESS', ledger: 1 }),
    getEvents: async () => ({ events: [] }),
  });

  const event = verifier.normalizeEvent({
    id: '000001-0000000002',
    contractId: 'C_MARKET',
    ledger: 99,
    txHash,
    topic: ['offer_matched', 7, 'GBORROWER'],
    value: 11,
  }, {
    txHash,
    ledger: 99,
    status: 'SUCCESS',
    network: 'testnet',
    confirmedAt: new Date('2026-07-10T00:00:00.000Z'),
    raw: {},
  }, 0);

  assert.equal(event?.eventName, 'offer_matched');
  assert.equal(event?.offerId, '7');
  assert.equal(event?.loanId, '11');
  assert.equal(event?.actor, 'GBORROWER');
});

test('TransactionVerifier paginates transaction events within the transaction ledger', async () => {
  const calls: unknown[] = [];
  const verifier = new TransactionVerifierService({
    getLatestLedger: async () => ({ sequence: 1 }),
    getTransaction: async () => ({ status: 'SUCCESS', ledger: 99 }),
    getEvents: async (input) => {
      calls.push(input);
      const cursor = (input as { cursor?: string }).cursor;
      if (!cursor) {
        return {
          cursor: 'page-2',
          events: [{
            id: '000099-0000000001',
            contractId: 'C_MARKET',
            ledger: 99,
            txHash,
            topic: ['offer_funded', 7, 'GLENDER'],
            value: 100_000_000,
          }],
        };
      }
      return {
        events: [{
          id: '000099-0000000002',
          contractId: 'C_MARKET',
          ledger: 99,
          txHash,
          topic: ['offer_activated', 7, 'GLENDER'],
          value: 100_000_000,
        }],
      };
    },
  });

  const events = await verifier.getTransactionEvents({
    txHash,
    ledger: 99,
    status: 'SUCCESS',
    network: 'testnet',
    confirmedAt: new Date('2026-07-10T00:00:00.000Z'),
    raw: {},
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(events.map((event) => event.eventName), ['offer_funded', 'offer_activated']);
  assert.equal((calls[0] as { endLedger?: number }).endLedger, 99);
  assert.equal((calls[1] as { cursor?: string }).cursor, 'page-2');
});

test('TransactionVerifier normalizes actor from offer and oracle events', () => {
  const verifier = new TransactionVerifierService({
    getLatestLedger: async () => ({ sequence: 1 }),
    getTransaction: async () => ({ status: 'SUCCESS', ledger: 1 }),
    getEvents: async () => ({ events: [] }),
  });

  const transaction = {
    txHash,
    ledger: 99,
    status: 'SUCCESS' as const,
    network: 'testnet',
    confirmedAt: new Date('2026-07-10T00:00:00.000Z'),
    raw: {},
  };
  const offerEvent = verifier.normalizeEvent({
    id: '000001-0000000003',
    contractId: 'C_MARKET',
    ledger: 99,
    txHash,
    topic: ['offer_funded', 7, 'GLENDER'],
    value: 100_000_000,
  }, transaction, 0);
  const oracleEvent = verifier.normalizeEvent({
    id: '000001-0000000004',
    contractId: 'C_ORACLE',
    ledger: 99,
    txHash,
    topic: ['price_updated', 'XLM/USDC', 'GADMIN'],
    value: 25_000_000,
  }, transaction, 1);

  assert.equal(offerEvent?.actor, 'GLENDER');
  assert.equal(offerEvent?.amount?.toString(), '10');
  assert.equal(oracleEvent?.actor, 'GADMIN');
  assert.equal(oracleEvent?.asset, 'XLM/USDC');
});
