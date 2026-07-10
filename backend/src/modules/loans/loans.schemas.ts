import { z } from 'zod';
import { confirmedChainReceiptSchema } from '../transactions/transactions.schemas';

const decimalInput = z.union([z.string().min(1), z.number()]).transform(String);

export const createLoanSchema = z.object({
  contractLoanId: z.coerce.bigint(),
  offerId: z.string().optional(),
  contractOfferId: z.coerce.bigint().optional(),
  lenderWallet: z.string().min(1),
  borrowerWallet: z.string().min(1),
  loanAsset: z.string().min(1),
  principal: decimalInput,
  outstandingDebt: decimalInput,
  fixedAprBps: z.coerce.number().int().positive(),
  collateralAsset: z.string().min(1),
  collateralAmount: decimalInput,
  startTime: z.coerce.date().optional(),
  dueTime: z.coerce.date().optional(),
  maxLtvBps: z.coerce.number().int().positive(),
  liquidationThresholdBps: z.coerce.number().int().positive(),
  liquidationBonusBps: z.coerce.number().int().nonnegative(),
  minHealthFactorBps: z.coerce.number().int().positive().default(14000),
  gracePeriodDays: z.coerce.number().int().nonnegative(),
  healthFactor: decimalInput.optional(),
  ltv: decimalInput.optional(),
  riskZone: z.enum(['SAFE', 'WARNING', 'LIQUIDATION_PLANNING']).optional(),
  status: z
    .enum([
      'PendingCollateral',
      'Active',
      'Warning',
      'LiquidationPlanning',
      'Repaid',
      'Closed',
      'Expired',
      'Defaulted',
      'Liquidated'
    ])
    .default('PendingCollateral'),
}).merge(confirmedChainReceiptSchema);

export const updateLoanSchema = createLoanSchema.partial().extend({
  action: z
    .enum([
      'ADD_COLLATERAL',
      'PARTIAL_REPAY',
      'FULL_REPAY',
      'LIQUIDATE',
      'CLAIM_REPAYMENT'
    ])
    .optional(),
  wallet: z.string().min(1).optional(),
  amount: decimalInput.optional()
}).merge(confirmedChainReceiptSchema.partial());

export const activateLoanSchema = z.object({
  wallet: z.string().min(1).optional(),
  contractLoanId: z.coerce.bigint().optional()
}).merge(confirmedChainReceiptSchema);

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
export type ActivateLoanInput = z.infer<typeof activateLoanSchema>;
