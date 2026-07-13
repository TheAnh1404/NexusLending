import { Prisma } from '@prisma/client';

export type DecimalInput = number | string | Prisma.Decimal;

export const MAX_FIXED_APR_BPS = 2_000;
export const MAX_FIXED_APR_PERCENT = MAX_FIXED_APR_BPS / 100;

const toDecimal = (value: DecimalInput): Prisma.Decimal => new Prisma.Decimal(value);
const round2 = (value: Prisma.Decimal): number => value.toDecimalPlaces(2).toNumber();

export const calculateHealthFactor = (
  collateralAmount: DecimalInput,
  collateralPrice: DecimalInput,
  borrowedAmount: DecimalInput,
  borrowPrice: DecimalInput,
  liquidationThresholdPercent: DecimalInput
): number => {
  const borrowed = toDecimal(borrowedAmount);
  if (borrowed.lte(0)) return 99.99;

  const collateralValue = toDecimal(collateralAmount).mul(toDecimal(collateralPrice));
  const borrowValue = borrowed.mul(toDecimal(borrowPrice));
  if (borrowValue.lte(0)) return 99.99;

  const healthFactor = collateralValue
    .mul(toDecimal(liquidationThresholdPercent).div(100))
    .div(borrowValue);
  return round2(healthFactor);
};

export const calculateLTV = (
  collateralAmount: DecimalInput,
  collateralPrice: DecimalInput,
  borrowedAmount: DecimalInput,
  borrowPrice: DecimalInput
): number => {
  const collateralValue = toDecimal(collateralAmount).mul(toDecimal(collateralPrice));
  if (collateralValue.lte(0)) return 0;
  const borrowValue = toDecimal(borrowedAmount).mul(toDecimal(borrowPrice));
  return round2(borrowValue.div(collateralValue).mul(100));
};

export const getRiskZone = (healthFactor: DecimalInput): 'SAFE' | 'WARNING' | 'LIQUIDATION_PLANNING' => {
  const hf = toDecimal(healthFactor);
  if (hf.gte(1.4)) return 'SAFE';
  if (hf.gte(1.2)) return 'WARNING';
  return 'LIQUIDATION_PLANNING';
};

export const calculateRepaymentAmount = (
  principal: DecimalInput,
  aprPercent: DecimalInput,
  durationDays: DecimalInput
): number => {
  const interest = toDecimal(principal)
    .mul(toDecimal(aprPercent).div(100))
    .mul(toDecimal(durationDays).div(365));
  return round2(toDecimal(principal).add(interest));
};

export const calculateRequiredCollateral = (
  borrowedAmount: DecimalInput,
  borrowPrice: DecimalInput,
  collateralPrice: DecimalInput,
  maxLTVPercent: DecimalInput
): number => {
  const price = toDecimal(collateralPrice);
  const maxLtv = toDecimal(maxLTVPercent);
  if (price.lte(0) || maxLtv.lte(0)) return 0;
  const borrowValue = toDecimal(borrowedAmount).mul(toDecimal(borrowPrice));
  return round2(borrowValue.div(maxLtv.div(100)).div(price));
};
