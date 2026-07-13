import { LoanStatus, Prisma, RiskZone } from '@prisma/client';

import { prisma } from '../../prisma/client';
import { loansService } from '../loans/loans.service';

const DAY_MS = 86_400_000;
const DEFAULT_GRACE_PERIOD_DAYS = 7;

const activeDebtStatuses: LoanStatus[] = [
  'Active',
  'Warning',
  'LiquidationPlanning',
  'Expired',
  'Defaulted'
];

const riskZones: RiskZone[] = ['SAFE', 'WARNING', 'LIQUIDATION_PLANNING'];

const riskLabels: Record<RiskZone, string> = {
  SAFE: 'Safe',
  WARNING: 'Warning',
  LIQUIDATION_PLANNING: 'Liquidation'
};

type LoanWithOffer = Prisma.LoanGetPayload<{ include: { offer: true } }>;

type MaturityBucketKey = 'defaulted' | 'grace' | 'due_7d' | 'due_30d' | 'later';

const maturityLabels: Record<MaturityBucketKey, string> = {
  defaulted: 'Defaulted',
  grace: 'Grace period',
  due_7d: 'Due <= 7d',
  due_30d: 'Due 8-30d',
  later: 'Later'
};

const maturitySortPriority: Record<MaturityBucketKey, number> = {
  defaulted: 0,
  grace: 1,
  due_7d: 2,
  due_30d: 3,
  later: 4
};

const toNumber = (
  value: Prisma.Decimal | string | number | null | undefined,
  fallback = 0
): number => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const roundPct = (value: number): number => Math.round(value * 100) / 100;

const healthFactorNumber = (loan: LoanWithOffer): number => toNumber(loan.healthFactor, 99.99);

const loanReference = (loan: LoanWithOffer): string =>
  loan.contractLoanId?.toString() ?? loan.id;

const buildAssetPriceLookup = async () => {
  const prices = await prisma.oraclePrice.findMany({
    orderBy: { updatedAt: 'desc' }
  });

  const byPair = new Map<string, number>();
  const byBaseAsset = new Map<string, number>();

  for (const price of prices) {
    const value = toNumber(price.price);
    byPair.set(price.assetPair, value);
    if (price.baseAsset && price.quoteAsset === 'USDC') {
      byBaseAsset.set(price.baseAsset, value);
    }
  }

  byBaseAsset.set('USDC', 1);
  byPair.set('USDC/USDC', 1);

  return {
    prices,
    assetPrice(asset: string, quoteAsset = 'USDC'): number {
      if (asset === quoteAsset) return 1;
      return byPair.get(`${asset}/${quoteAsset}`) ?? byBaseAsset.get(asset) ?? 0;
    }
  };
};

const collateralValueForLoan = (
  loan: LoanWithOffer,
  assetPrice: (asset: string, quoteAsset?: string) => number
): number => {
  const price = assetPrice(loan.collateralAsset, loan.loanAsset);
  return toNumber(loan.collateralAmount) * price;
};

const debtValueForLoan = (
  loan: LoanWithOffer,
  assetPrice: (asset: string, quoteAsset?: string) => number
): number => {
  const price = assetPrice(loan.loanAsset, 'USDC');
  return toNumber(loan.outstandingDebt) * (price || 1);
};

const maturityBucketForLoan = (loan: LoanWithOffer, now: number): MaturityBucketKey => {
  if (loan.status === 'Defaulted') return 'defaulted';
  if (!loan.dueTime) return 'later';

  const dueTime = loan.dueTime.getTime();
  const gracePeriodDays = loan.gracePeriodDays || DEFAULT_GRACE_PERIOD_DAYS;
  const defaultTime = dueTime + gracePeriodDays * DAY_MS;

  if (now > defaultTime) return 'defaulted';
  if (now > dueTime) return 'grace';

  const daysUntilDue = Math.ceil((dueTime - now) / DAY_MS);
  if (daysUntilDue <= 7) return 'due_7d';
  if (daysUntilDue <= 30) return 'due_30d';
  return 'later';
};

const recommendedAction = (bucket: MaturityBucketKey): string => {
  if (bucket === 'defaulted') return 'Eligible for default handling';
  if (bucket === 'grace') return 'Repay before grace deadline';
  if (bucket === 'due_7d') return 'Prepare repayment';
  if (bucket === 'due_30d') return 'Monitor maturity';
  return 'No immediate action';
};

export const analyticsService = {
  async dashboard() {
    const [loans, priceLookup] = await Promise.all([
      loansService.list({}),
      buildAssetPriceLookup()
    ]);
    const now = Date.now();
    const activeLoans = loans.filter((loan) =>
      activeDebtStatuses.includes(loan.status) && toNumber(loan.outstandingDebt) > 0
    );
    const totalDebt = activeLoans.reduce(
      (sum, loan) => sum + debtValueForLoan(loan, priceLookup.assetPrice),
      0
    );

    const riskBuckets = riskZones.map((riskZone) => {
      const zoneLoans = activeLoans.filter((loan) => loan.riskZone === riskZone);
      const debtAmount = zoneLoans.reduce(
        (sum, loan) => sum + debtValueForLoan(loan, priceLookup.assetPrice),
        0
      );
      const collateralValue = zoneLoans.reduce(
        (sum, loan) => sum + collateralValueForLoan(loan, priceLookup.assetPrice),
        0
      );
      const avgHealthFactor = zoneLoans.length > 0
        ? zoneLoans.reduce((sum, loan) => sum + healthFactorNumber(loan), 0) / zoneLoans.length
        : null;

      return {
        riskZone,
        label: riskLabels[riskZone],
        loanCount: zoneLoans.length,
        debtAmount: roundMoney(debtAmount),
        collateralValue: roundMoney(collateralValue),
        debtSharePct: totalDebt > 0 ? roundPct((debtAmount / totalDebt) * 100) : 0,
        avgHealthFactor: avgHealthFactor === null ? null : Math.round(avgHealthFactor * 100) / 100
      };
    });

    const riskPriority: Record<RiskZone, number> = {
      LIQUIDATION_PLANNING: 0,
      WARNING: 1,
      SAFE: 2
    };

    const topRiskLoans = [...activeLoans]
      .sort((a, b) => {
        const zoneDiff = riskPriority[a.riskZone] - riskPriority[b.riskZone];
        if (zoneDiff !== 0) return zoneDiff;
        return healthFactorNumber(a) - healthFactorNumber(b);
      })
      .slice(0, 6)
      .map((loan) => ({
        id: loan.id,
        contractLoanId: loan.contractLoanId?.toString() ?? null,
        reference: loanReference(loan),
        borrowerWallet: loan.borrowerWallet,
        lenderWallet: loan.lenderWallet,
        status: loan.status,
        riskZone: loan.riskZone,
        healthFactor: healthFactorNumber(loan),
        outstandingDebt: roundMoney(toNumber(loan.outstandingDebt)),
        loanAsset: loan.loanAsset,
        collateralAmount: roundMoney(toNumber(loan.collateralAmount)),
        collateralAsset: loan.collateralAsset,
        collateralValue: roundMoney(collateralValueForLoan(loan, priceLookup.assetPrice)),
        dueTime: loan.dueTime?.toISOString() ?? null
      }));

    const atRiskDebt = riskBuckets
      .filter((bucket) => bucket.riskZone !== 'SAFE')
      .reduce((sum, bucket) => sum + bucket.debtAmount, 0);
    const avgHealthFactor = activeLoans.length > 0
      ? activeLoans.reduce((sum, loan) => sum + healthFactorNumber(loan), 0) / activeLoans.length
      : 99.99;

    const maturityBuckets = (Object.keys(maturityLabels) as MaturityBucketKey[]).map((key) => {
      const bucketLoans = activeLoans.filter((loan) => maturityBucketForLoan(loan, now) === key);
      const debtAmount = bucketLoans.reduce(
        (sum, loan) => sum + debtValueForLoan(loan, priceLookup.assetPrice),
        0
      );

      return {
        key,
        label: maturityLabels[key],
        loanCount: bucketLoans.length,
        debtAmount: roundMoney(debtAmount)
      };
    });

    const maturityItems = activeLoans
      .filter((loan) => loan.dueTime)
      .map((loan) => {
        const dueTime = loan.dueTime as Date;
        const bucket = maturityBucketForLoan(loan, now);
        const gracePeriodDays = loan.gracePeriodDays || DEFAULT_GRACE_PERIOD_DAYS;
        const graceDeadline = new Date(dueTime.getTime() + gracePeriodDays * DAY_MS);
        const daysUntilDue = Math.ceil((dueTime.getTime() - now) / DAY_MS);
        const daysPastDue = Math.max(0, Math.ceil((now - dueTime.getTime()) / DAY_MS));

        return {
          id: loan.id,
          contractLoanId: loan.contractLoanId?.toString() ?? null,
          reference: loanReference(loan),
          borrowerWallet: loan.borrowerWallet,
          lenderWallet: loan.lenderWallet,
          status: loan.status,
          riskZone: loan.riskZone,
          healthFactor: healthFactorNumber(loan),
          outstandingDebt: roundMoney(toNumber(loan.outstandingDebt)),
          loanAsset: loan.loanAsset,
          dueTime: dueTime.toISOString(),
          graceDeadline: graceDeadline.toISOString(),
          daysUntilDue,
          daysPastDue,
          bucket,
          bucketLabel: maturityLabels[bucket],
          recommendedAction: recommendedAction(bucket)
        };
      })
      .sort((a, b) => {
        const bucketDiff = maturitySortPriority[a.bucket] - maturitySortPriority[b.bucket];
        if (bucketDiff !== 0) return bucketDiff;
        return new Date(a.dueTime).getTime() - new Date(b.dueTime).getTime();
      })
      .slice(0, 12);

    return {
      generatedAt: new Date().toISOString(),
      source: 'database',
      hasData: activeLoans.length > 0,
      oracleUpdatedAt: priceLookup.prices[0]?.updatedAt.toISOString() ?? null,
      riskExposure: {
        totalDebt: roundMoney(totalDebt),
        atRiskDebt: roundMoney(atRiskDebt),
        activeLoanCount: activeLoans.length,
        avgHealthFactor: Math.round(avgHealthFactor * 100) / 100,
        buckets: riskBuckets,
        topRiskLoans
      },
      repaymentCalendar: {
        buckets: maturityBuckets,
        items: maturityItems
      }
    };
  }
};
