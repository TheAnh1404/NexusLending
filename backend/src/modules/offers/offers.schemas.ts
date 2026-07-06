import { z } from 'zod';

const decimalInput = z.union([z.string().min(1), z.number()]).transform(String);

export const createOfferSchema = z.object({
  contractOfferId: z.coerce.bigint().optional(),
  lenderWallet: z.string().min(1),
  loanAsset: z.string().min(1),
  loanAmount: decimalInput,
  fixedAprBps: z.coerce.number().int().positive(),
  durationDays: z.coerce.number().int().positive(),
  collateralAsset: z.string().min(1),
  maxLtvBps: z.coerce.number().int().positive(),
  liquidationThresholdBps: z.coerce.number().int().positive(),
  liquidationBonusBps: z.coerce.number().int().nonnegative(),
  gracePeriodDays: z.coerce.number().int().nonnegative(),
  minHealthFactorBps: z.coerce.number().int().positive().default(14000),
  status: z
    .enum(['Draft', 'Funding', 'Active', 'Matched', 'Cancelled', 'Expired'])
    .default('Draft'),
  description: z.string().optional(),
  txHash: z.string().optional(),
  explorerUrl: z.string().url().optional()
});

export const updateOfferStatusSchema = z.object({
  status: z.enum(['Draft', 'Funding', 'Active', 'Matched', 'Cancelled', 'Expired']),
  txHash: z.string().optional(),
  explorerUrl: z.string().url().optional()
});

export const offerActionWalletSchema = z.object({
  wallet: z.string().min(1).optional()
});

export const acceptOfferSchema = z.object({
  borrowerWallet: z.string().min(1),
  collateralAmount: decimalInput,
  contractLoanId: z.coerce.bigint().optional()
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferStatusInput = z.infer<typeof updateOfferStatusSchema>;
export type OfferActionWalletInput = z.infer<typeof offerActionWalletSchema>;
export type AcceptOfferInput = z.infer<typeof acceptOfferSchema>;
