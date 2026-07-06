import type { RiskZone } from '../types';

export const calculateHealthFactor = (
  collateralAmount: number,
  collateralPrice: number,
  borrowedAmount: number,
  borrowPrice: number,
  liquidationThresholdPercent: number
): number => {
  if (borrowedAmount <= 0) return 99.99; // Essentially safe/infinite
  const collateralValue = collateralAmount * collateralPrice;
  const borrowValue = borrowedAmount * borrowPrice;
  const healthFactor = (collateralValue * (liquidationThresholdPercent / 100)) / borrowValue;
  return Math.round(healthFactor * 100) / 100;
};

export const calculateLTV = (
  collateralAmount: number,
  collateralPrice: number,
  borrowedAmount: number,
  borrowPrice: number
): number => {
  const collateralValue = collateralAmount * collateralPrice;
  if (collateralValue <= 0) return 0;
  const borrowValue = borrowedAmount * borrowPrice;
  const ltv = (borrowValue / collateralValue) * 100;
  return Math.round(ltv * 100) / 100;
};

export const calculateRequiredCollateral = (
  borrowedAmount: number,
  borrowPrice: number,
  collateralPrice: number,
  maxLTVPercent: number
): number => {
  if (collateralPrice <= 0 || maxLTVPercent <= 0) return 0;
  const borrowValue = borrowedAmount * borrowPrice;
  const requiredCollateralValue = borrowValue / (maxLTVPercent / 100);
  const requiredAmount = requiredCollateralValue / collateralPrice;
  return Math.round(requiredAmount * 100) / 100;
};

export const getRiskZone = (healthFactor: number): RiskZone => {
  if (healthFactor >= 1.4) return 'SAFE';
  if (healthFactor >= 1.2) return 'WARNING';
  return 'LIQUIDATION_PLANNING';
};

export const getLoanStatusFromHealthFactor = (healthFactor: number) => {
  if (healthFactor >= 1.4) return 'Active' as const;
  if (healthFactor >= 1.2) return 'Warning' as const;
  return 'LiquidationPlanning' as const;
};

export const isOpenLoanStatus = (status: string): boolean =>
  ['PendingCollateral', 'Active', 'Warning', 'LiquidationPlanning', 'Expired', 'Defaulted'].includes(status);

export const isLiquidatable = (healthFactor: number, status?: string): boolean =>
  status === 'LiquidationPlanning' ||
  status === 'Defaulted' ||
  (status !== 'PendingCollateral' && healthFactor < 1.2);

export const calculateCollateralValue = (
  collateralAmount: number,
  collateralPrice: number
): number => Math.round(collateralAmount * collateralPrice * 100) / 100;

export const calculateInterestAmount = (
  principal: number,
  apr: number,
  durationDays: number
): number => {
  const interest = principal * (apr / 100) * (durationDays / 365);
  return Math.round(interest * 100) / 100;
};

export const formatCurrency = (value: number, asset: string): string => {
  if (asset.toUpperCase() === 'USDC') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)} ${asset.toUpperCase()}`;
};

export const formatAddress = (address: string | null): string => {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

export const calculateRepaymentAmount = (
  principal: number,
  apr: number,
  durationDays: number
): number => {
  const interest = principal * (apr / 100) * (durationDays / 365);
  return Math.round((principal + interest) * 100) / 100;
};
