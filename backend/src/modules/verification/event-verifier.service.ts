import { Prisma } from '@prisma/client';

import {
  WrongAmountError,
  WrongContractError,
  WrongEntityError,
  WrongEventError,
  WrongWalletError,
} from './verification.errors';
import type { NormalizedEvent, VerificationAction, VerificationRequest } from './verification.types';

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

    if (
      request.expectedWallet &&
      matchingEvent.actor &&
      normalizeAddress(request.expectedWallet) !== normalizeAddress(matchingEvent.actor)
    ) {
      throw new WrongWalletError(request.expectedWallet, matchingEvent.actor);
    }

    if (
      request.expectedOfferId &&
      matchingEvent.offerId &&
      String(request.expectedOfferId) !== String(matchingEvent.offerId)
    ) {
      throw new WrongEntityError(request.expectedOfferId, matchingEvent.offerId);
    }

    if (
      request.expectedLoanId &&
      matchingEvent.loanId &&
      String(request.expectedLoanId) !== String(matchingEvent.loanId)
    ) {
      throw new WrongEntityError(request.expectedLoanId, matchingEvent.loanId);
    }

    if (
      request.expectedAmount !== undefined &&
      matchingEvent.amount &&
      !matchingEvent.amount.eq(decimal(request.expectedAmount))
    ) {
      throw new WrongAmountError(decimal(request.expectedAmount).toString(), matchingEvent.amount.toString());
    }

    if (
      request.expectedAsset &&
      matchingEvent.asset &&
      normalizeAddress(request.expectedAsset) !== normalizeAddress(matchingEvent.asset)
    ) {
      throw new WrongEntityError(request.expectedAsset, matchingEvent.asset);
    }

    return matchingEvent;
  }
}

export const eventVerifierService = new EventVerifierService();

