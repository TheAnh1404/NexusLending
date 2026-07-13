import type {
  DashboardAnalytics,
  MaturityBucket,
  MaturityCalendarItem,
  RiskExposureBucket,
  RiskExposureLoan,
} from '../../types';
import { apiClient, toNumber } from './client';

type BackendDashboardAnalytics = Omit<DashboardAnalytics, 'riskExposure' | 'repaymentCalendar'> & {
  riskExposure: {
    totalDebt: string | number;
    atRiskDebt: string | number;
    activeLoanCount: number;
    avgHealthFactor: string | number;
    buckets: Array<Omit<RiskExposureBucket, 'debtAmount' | 'collateralValue' | 'debtSharePct' | 'avgHealthFactor'> & {
      debtAmount: string | number;
      collateralValue: string | number;
      debtSharePct: string | number;
      avgHealthFactor: string | number | null;
    }>;
    topRiskLoans: Array<Omit<RiskExposureLoan, 'healthFactor' | 'outstandingDebt' | 'collateralAmount' | 'collateralValue'> & {
      healthFactor: string | number;
      outstandingDebt: string | number;
      collateralAmount: string | number;
      collateralValue: string | number;
    }>;
  };
  repaymentCalendar: {
    buckets: Array<Omit<MaturityBucket, 'debtAmount'> & {
      debtAmount: string | number;
    }>;
    items: Array<Omit<MaturityCalendarItem, 'healthFactor' | 'outstandingDebt' | 'daysUntilDue' | 'daysPastDue'> & {
      healthFactor: string | number;
      outstandingDebt: string | number;
      daysUntilDue: string | number;
      daysPastDue: string | number;
    }>;
  };
};

const mapRiskBucket = (bucket: BackendDashboardAnalytics['riskExposure']['buckets'][number]): RiskExposureBucket => ({
  ...bucket,
  debtAmount: toNumber(bucket.debtAmount),
  collateralValue: toNumber(bucket.collateralValue),
  debtSharePct: toNumber(bucket.debtSharePct),
  avgHealthFactor: bucket.avgHealthFactor === null ? null : toNumber(bucket.avgHealthFactor),
});

const mapRiskLoan = (loan: BackendDashboardAnalytics['riskExposure']['topRiskLoans'][number]): RiskExposureLoan => ({
  ...loan,
  healthFactor: toNumber(loan.healthFactor),
  outstandingDebt: toNumber(loan.outstandingDebt),
  collateralAmount: toNumber(loan.collateralAmount),
  collateralValue: toNumber(loan.collateralValue),
});

const mapMaturityBucket = (bucket: BackendDashboardAnalytics['repaymentCalendar']['buckets'][number]): MaturityBucket => ({
  ...bucket,
  debtAmount: toNumber(bucket.debtAmount),
});

const mapMaturityItem = (item: BackendDashboardAnalytics['repaymentCalendar']['items'][number]): MaturityCalendarItem => ({
  ...item,
  healthFactor: toNumber(item.healthFactor),
  outstandingDebt: toNumber(item.outstandingDebt),
  daysUntilDue: toNumber(item.daysUntilDue),
  daysPastDue: toNumber(item.daysPastDue),
});

const mapDashboardAnalytics = (analytics: BackendDashboardAnalytics): DashboardAnalytics => ({
  ...analytics,
  riskExposure: {
    ...analytics.riskExposure,
    totalDebt: toNumber(analytics.riskExposure.totalDebt),
    atRiskDebt: toNumber(analytics.riskExposure.atRiskDebt),
    avgHealthFactor: toNumber(analytics.riskExposure.avgHealthFactor, 99.99),
    buckets: analytics.riskExposure.buckets.map(mapRiskBucket),
    topRiskLoans: analytics.riskExposure.topRiskLoans.map(mapRiskLoan),
  },
  repaymentCalendar: {
    buckets: analytics.repaymentCalendar.buckets.map(mapMaturityBucket),
    items: analytics.repaymentCalendar.items.map(mapMaturityItem),
  },
});

export const analyticsApi = {
  async dashboard(): Promise<DashboardAnalytics> {
    const analytics = await apiClient.get<BackendDashboardAnalytics>('/api/analytics/dashboard');
    return mapDashboardAnalytics(analytics);
  },
};
