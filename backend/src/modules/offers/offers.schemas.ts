import { z } from 'zod';
import { MAX_FIXED_APR_BPS } from '../../utils/finance.js';
import { confirmedChainReceiptSchema, optionalDateSchema } from '../transactions/transactions.schemas.js';

const decimalInput = z.union([z.string().min(1), z.number()]).transform(String);

export const createOfferSchema = z.object({
  contractOfferId: z.coerce.bigint().optional(),
  lenderWallet: z.string().min(1),
  loanAsset: z.string().min(1),
  loanAmount: decimalInput,
  fixedAprBps: z.coerce.number().int().positive().max(MAX_FIXED_APR_BPS),
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
  txHash: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  explorerUrl: z.string().url().refine((val) => val.startsWith('https://stellar.expert/explorer/')).optional(),
  ledger: z.coerce.number().int().positive().optional(),
  txStatus: z.literal('SUCCESS').optional(),
  contractId: z.string().min(1).optional(),
  blockTimestamp: optionalDateSchema,
  contractReturnValue: z.unknown().optional()
});

export const updateOfferStatusSchema = z.object({
  status: z.enum(['Draft', 'Funding', 'Active', 'Matched', 'Cancelled', 'Expired']),
  wallet: z.string().min(1).optional()
}).merge(confirmedChainReceiptSchema.partial());

export const offerActionWalletSchema = z.object({
  wallet: z.string().min(1).optional(),
  contractOfferId: z.coerce.bigint().optional()
}).merge(confirmedChainReceiptSchema);

export const syncOfferSchema = z.object({
  wallet: z.string().min(1).optional()
});

export const acceptOfferSchema = z.object({
  borrowerWallet: z.string().min(1).optional(),
  collateralAmount: decimalInput.optional(),
  contractLoanId: z.coerce.bigint().optional()
}).merge(confirmedChainReceiptSchema);


export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferStatusInput = z.infer<typeof updateOfferStatusSchema>;
export type OfferActionWalletInput = z.infer<typeof offerActionWalletSchema>;
export type SyncOfferInput = z.infer<typeof syncOfferSchema>;
export type AcceptOfferInput = z.infer<typeof acceptOfferSchema>;
