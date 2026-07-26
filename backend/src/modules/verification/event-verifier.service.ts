import { Prisma } from '@prisma/client';

import {
  WrongAmountError,
  WrongContractError,
  WrongEntityError,
  WrongEventError,
  WrongWalletError,
} from './verification.errors.js';
import type { NormalizedEvent, VerificationAction, VerificationRequest } from './verification.types.js';

const actionEvents: Record<VerificationAction, string[]> = {
  create_offer: ['offer_created'],
  fund_offer: ['offer_funded'],
  activate_offer: ['offer_activated'],
  cancel_offer: ['offer_cancelled'],
  expire_offer: ['offer_expired'],
  accept_offer: ['offer_matched'],
  activate_loan: ['loan_activated'],
  add_collateral: ['collateral_added'],
  partial_repay: ['partial_repaid'],
  full_repay: ['loan_repaid'],
  liquidate: ['loan_liquidated'],
  oracle_update: ['price_updated'],
};

const normalizeAddress = (value?: string): string | undefined => value?.trim().toUpperCase() || undefined;

const decimal = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const assertExpectedString = (
  expected: string | undefined,
  actual: string | undefined,
  errorFactory: (expected: string, actual?: string) => Error
) => {
  if (expected === undefined) return;
  if (actual === undefined || String(expected) !== String(actual)) {
    throw errorFactory(String(expected), actual);
  }
};

const assertExpectedAddress = (
  expected: string | undefined,
  actual: string | undefined,
  errorFactory: (expected: string, actual?: string) => Error
) => {
  if (expected === undefined) return;
  if (!actual || normalizeAddress(expected) !== normalizeAddress(actual)) {
    throw errorFactory(expected, actual);
  }
};

export class EventVerifierService {
  getExpectedEvents(action: VerificationAction): string[] {
    return actionEvents[action];
  }

  verify(request: VerificationRequest, events: NormalizedEvent[]): NormalizedEvent {
    const expectedEvents = this.getExpectedEvents(request.action);
    const actualNames = events.map((event) => event.eventName);
    const matchingEvent = events.find((event) => expectedEvents.includes(event.eventName));

    if (!matchingEvent) {
      throw new WrongEventError(expectedEvents, actualNames);
    }

    if (
      request.expectedContractId &&
      matchingEvent.contractId !== request.expectedContractId
    ) {
      throw new WrongContractError(request.expectedContractId, matchingEvent.contractId);
    }

    assertExpectedAddress(request.expectedWallet, matchingEvent.actor, (expected, actual) =>
      new WrongWalletError(expected, actual)
    );

    assertExpectedString(request.expectedOfferId, matchingEvent.offerId, (expected, actual) =>
      new WrongEntityError(expected, actual)
    );

    assertExpectedString(request.expectedLoanId, matchingEvent.loanId, (expected, actual) =>
      new WrongEntityError(expected, actual)
    );

    if (request.expectedAmount !== undefined) {
      if (!matchingEvent.amount) {
        throw new WrongAmountError(decimal(request.expectedAmount).toString());
      }
      if (!matchingEvent.amount.eq(decimal(request.expectedAmount))) {
        throw new WrongAmountError(decimal(request.expectedAmount).toString(), matchingEvent.amount.toString());
      }
    }

    assertExpectedAddress(request.expectedAsset, matchingEvent.asset, (expected, actual) =>
      new WrongEntityError(expected, actual)
    );

    return matchingEvent;
  }
}

export const eventVerifierService = new EventVerifierService();
