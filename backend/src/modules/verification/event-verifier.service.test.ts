import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

import { EventVerifierService } from './event-verifier.service';
import {
  WrongAmountError,
  WrongContractError,
  WrongEntityError,
  WrongEventError,
  WrongWalletError,
} from './verification.errors';
import type { NormalizedEvent } from './verification.types';

const baseEvent: NormalizedEvent = {
  contractId: 'C_MARKET',
  ledger: 10,
  txHash: 'a'.repeat(64),
  eventIndex: 1,
  eventName: 'offer_funded',
  actor: 'GABC',
  offerId: '42',
  amount: new Prisma.Decimal(100),
  timestamp: new Date('2026-07-10T00:00:00.000Z'),
  entityType: 'offer',
  entityId: '42',
  network: 'testnet',
  explorerUrl: `https://stellar.expert/explorer/testnet/tx/${'a'.repeat(64)}`,
  payload: {},
};

test('EventVerifier accepts the expected event contract wallet entity and amount', () => {
  const verifier = new EventVerifierService();
  const event = verifier.verify({
    action: 'fund_offer',
    txHash: baseEvent.txHash,
    expectedContractId: 'C_MARKET',
    expectedWallet: 'gabc',
    expectedOfferId: '42',
    expectedAmount: 100,
  }, [baseEvent]);

  assert.equal(event.eventName, 'offer_funded');
});

test('EventVerifier rejects wrong event', () => {
  const verifier = new EventVerifierService();
  assert.throws(() => verifier.verify({
    action: 'activate_offer',
    txHash: baseEvent.txHash,
  }, [baseEvent]), WrongEventError);
});

test('EventVerifier rejects wrong contract wallet and amount', () => {
  const verifier = new EventVerifierService();

  assert.throws(() => verifier.verify({
    action: 'fund_offer',
    txHash: baseEvent.txHash,
    expectedContractId: 'C_OTHER',
  }, [baseEvent]), WrongContractError);

  assert.throws(() => verifier.verify({
    action: 'fund_offer',
    txHash: baseEvent.txHash,
    expectedWallet: 'GDIFFERENT',
  }, [baseEvent]), WrongWalletError);

  assert.throws(() => verifier.verify({
    action: 'fund_offer',
    txHash: baseEvent.txHash,
    expectedAmount: 101,
  }, [baseEvent]), WrongAmountError);
});

test('EventVerifier rejects missing expected fields', () => {
  const verifier = new EventVerifierService();
  const eventWithoutOptionalFields: NormalizedEvent = {
    ...baseEvent,
    actor: undefined,
    offerId: undefined,
    amount: undefined,
  };

  assert.throws(() => verifier.verify({
    action: 'fund_offer',
    txHash: baseEvent.txHash,
    expectedWallet: 'GABC',
  }, [eventWithoutOptionalFields]), WrongWalletError);

  assert.throws(() => verifier.verify({
    action: 'fund_offer',
    txHash: baseEvent.txHash,
    expectedOfferId: '42',
  }, [eventWithoutOptionalFields]), WrongEntityError);

  assert.throws(() => verifier.verify({
    action: 'fund_offer',
    txHash: baseEvent.txHash,
    expectedAmount: 100,
  }, [eventWithoutOptionalFields]), WrongAmountError);
});
