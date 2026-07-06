import type { Loan, LoanOffer, LoanStatus } from '../../types';
import {
  calculateHealthFactor,
  calculateLTV,
  calculateRepaymentAmount,
  getLoanStatusFromHealthFactor,
  isOpenLoanStatus,
} from '../../utils/finance';

interface PriceMap {
  xlmPrice: number;
  usdcPrice: number;
}

export interface BorrowPreview {
  collateralValue: number;
  ltv: number;
  healthFactor: number;
  repaymentAmount: number;
  status: LoanStatus;
}

export const loansService = {
  normalize(loan: Loan, prices: PriceMap): Loan {
    if (loan.status === 'PendingCollateral') return loan;
    if (!isOpenLoanStatus(loan.status)) return loan;
    return this.recalculate(loan, prices);
  },

  previewBorrow(offer: LoanOffer, collateralAmount: number, prices: PriceMap): BorrowPreview {
    const repaymentAmount = calculateRepaymentAmount(offer.amount, offer.apr, offer.duration);
    const healthFactor = calculateHealthFactor(
      collateralAmount,
      prices.xlmPrice,
      repaymentAmount,
      prices.usdcPrice,
      offer.liquidationThreshold
    );
    const ltv = calculateLTV(collateralAmount, prices.xlmPrice, repaymentAmount, prices.usdcPrice);

    return {
      collateralValue: Math.round(collateralAmount * prices.xlmPrice * 100) / 100,
      ltv,
      healthFactor,
      repaymentAmount,
      status: getLoanStatusFromHealthFactor(healthFactor),
    };
  },

  createFromOffer(offer: LoanOffer, borrower: string, collateralAmount: number, prices: PriceMap): Loan {
    const preview = this.previewBorrow(offer, collateralAmount, prices);
    return {
      id: `loan_${Date.now()}`,
      offerId: offer.id,
      borrower,
      lender: offer.lender,
      amount: offer.amount,
      asset: offer.asset,
      apr: offer.apr,
      duration: offer.duration,
      collateralAsset: offer.collateralAsset,
      collateralAmount,
      outstandingDebt: preview.repaymentAmount,
      maxLTV: offer.maxLTV,
      liquidationThreshold: offer.liquidationThreshold,
      liquidationBonus: offer.liquidationBonus,
      healthFactor: preview.healthFactor,
      status: 'PendingCollateral',
      borrowTime: new Date().toISOString(),
      dueDate: new Date().toISOString(),
      minHealthFactor: offer.minHealthFactor,
      gracePeriod: offer.gracePeriod,
    };
  },

  activateLoan(loan: Loan, prices: PriceMap): Loan {
    const activated = this.recalculate(
      {
        ...loan,
        status: 'Active',
        borrowTime: new Date().toISOString(),
        dueDate: new Date(Date.now() + loan.duration * 24 * 60 * 60 * 1000).toISOString(),
      },
      prices
    );
    return {
      ...activated,
      status: activated.healthFactor >= (loan.minHealthFactor ?? 1.4) ? 'Active' : activated.status,
    };
  },

  recalculate(loan: Loan, prices: PriceMap): Loan {
    if (loan.status === 'PendingCollateral') return loan;
    if (!isOpenLoanStatus(loan.status)) return loan;
    if (loan.outstandingDebt <= 0) {
      return {
        ...loan,
        healthFactor: 99.99,
        status: 'Repaid',
      };
    }

    const healthFactor = calculateHealthFactor(
      loan.collateralAmount,
      prices.xlmPrice,
      loan.outstandingDebt,
      prices.usdcPrice,
      loan.liquidationThreshold
    );

    return {
      ...loan,
      healthFactor,
      status: getLoanStatusFromHealthFactor(healthFactor),
    };
  },

  addCollateral(loan: Loan, amount: number, prices: PriceMap): Loan {
    return this.recalculate(
      {
        ...loan,
        collateralAmount: loan.collateralAmount + amount,
      },
      prices
    );
  },

  repay(loan: Loan, amount: number, isFullRepay: boolean, prices: PriceMap): Loan {
    const repayAmount = isFullRepay ? loan.outstandingDebt : Math.min(amount, loan.outstandingDebt);
    const nextDebt = Math.max(0, Math.round((loan.outstandingDebt - repayAmount) * 100) / 100);

    if (nextDebt === 0) {
      return {
        ...loan,
        outstandingDebt: 0,
        collateralAmount: 0,
        healthFactor: 99.99,
        status: 'Repaid',
        closedAt: new Date().toISOString(),
      };
    }

    return this.recalculate(
      {
        ...loan,
        outstandingDebt: nextDebt,
      },
      prices
    );
  },

  liquidate(loan: Loan, repayAmount: number, prices: PriceMap): { loan: Loan; collateralReceived: number } {
    const repay = Math.min(repayAmount, loan.outstandingDebt);
    const collateralValueToReceive = repay * (1 + loan.liquidationBonus / 100);
    const collateralReceived = Math.min(loan.collateralAmount, collateralValueToReceive / prices.xlmPrice);
    const nextDebt = Math.max(0, Math.round((loan.outstandingDebt - repay) * 100) / 100);
    const nextCollateral = Math.max(0, Math.round((loan.collateralAmount - collateralReceived) * 100) / 100);

    if (nextDebt === 0 || nextCollateral === 0) {
      return {
        collateralReceived,
        loan: {
          ...loan,
          outstandingDebt: nextDebt,
          collateralAmount: nextCollateral,
          healthFactor: nextDebt === 0 ? 99.99 : 0,
          status: 'Liquidated',
          closedAt: new Date().toISOString(),
        },
      };
    }

    return {
      collateralReceived,
      loan: this.recalculate(
        {
          ...loan,
          outstandingDebt: nextDebt,
          collateralAmount: nextCollateral,
        },
        prices
      ),
    };
  },
};
