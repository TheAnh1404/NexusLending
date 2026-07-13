import type { LoanOffer, OfferStatus } from '../../types';
import { MAX_FIXED_APR_PERCENT } from '../../utils/finance';

export type CreateOfferInput = Omit<LoanOffer, 'id' | 'lender' | 'createTime' | 'status' | 'acceptedLoanId'>;

export const offersService = {
  normalize(offer: LoanOffer): LoanOffer {
    return {
      ...offer,
      status: offer.status ?? 'Draft',
    };
  },

  create(input: CreateOfferInput, lender: string): LoanOffer {
    if (input.apr > MAX_FIXED_APR_PERCENT) {
      throw new Error(`Fixed APR cannot exceed ${MAX_FIXED_APR_PERCENT}% per year.`);
    }

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
