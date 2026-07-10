import test from 'node:test';
import assert from 'node:assert/strict';

import { TransactionVerifierService } from './transaction-verifier.service';
import { TransactionNotFoundError, WrongNetworkError } from './verification.errors';

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

