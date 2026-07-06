import type { LoanOffer, OfferStatus } from '../../types';

export type CreateOfferInput = Omit<LoanOffer, 'id' | 'lender' | 'createTime' | 'status' | 'acceptedLoanId'>;

export const offersService = {
  normalize(offer: LoanOffer): LoanOffer {
    return {
      ...offer,
      status: offer.status ?? 'Draft',
    };
  },

  create(input: CreateOfferInput, lender: string): LoanOffer {
    return {
      ...input,
      id: `offer_${Date.now()}`,
      lender,
      createTime: new Date().toISOString(),
      status: 'Draft',
    };
  },

  updateStatus(offer: LoanOffer, status: OfferStatus, acceptedLoanId?: string): LoanOffer {
    return {
      ...offer,
      status,
      acceptedLoanId,
    };
  },
};
