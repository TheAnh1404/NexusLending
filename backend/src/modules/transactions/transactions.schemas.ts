import { z } from 'zod';

const decimalInput = z.union([z.string().min(1), z.number()]).transform(String);
const txHash = z.string().regex(/^[a-fA-F0-9]{64}$/, 'txHash must be a 64-character Stellar transaction hash');
const stellarExpertUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://stellar.expert/explorer/'), {
    message: 'explorerUrl must be a Stellar Expert URL'
  });

export const optionalDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}, z.date().optional());

export const confirmedChainReceiptSchema = z.object({
  txHash,
  explorerUrl: stellarExpertUrl.optional(),
  ledger: z.coerce.number().int().positive().optional(),
  txStatus: z.literal('SUCCESS').optional(),
  contractId: z.string().min(1).optional(),
  blockTimestamp: optionalDateSchema,
  contractReturnValue: z.unknown().optional()
});

export const createTransactionSchema = z.object({
  txHash,
  explorerUrl: stellarExpertUrl,
  contract: z.string().min(1).optional(),
  ledger: z.coerce.number().int().positive(),
  type: z.enum([
    'CONNECT_WALLET',
    'CREATE_OFFER',
    'FUND_OFFER',
    'ACTIVATE_OFFER',
    'CANCEL_OFFER',
    'EXPIRE_OFFER',
    'ACCEPT_OFFER',
    'ACTIVATE_LOAN',
    'BORROW_LOAN',
    'BORROW',
    'ADD_COLLATERAL',
    'PARTIAL_REPAY',
    'FULL_REPAY',
    'REPAY',
    'LIQUIDATE',
    'UPDATE_ORACLE',
    'ORACLE_UPDATE',
    'HEALTH_RECALCULATION',
    'CLAIM_REPAYMENT'
  ]),
  wallet: z.string().min(1),
  offerId: z.string().optional(),
  loanId: z.string().optional(),
  asset: z.string().optional(),
  amount: decimalInput.optional(),
  status: z.literal('SUCCESS').default('SUCCESS'),
  blockTimestamp: optionalDateSchema,
  metadata: z.unknown().optional()
}).refine((input) => input.explorerUrl.endsWith(`/tx/${input.txHash}`), {
  message: 'explorerUrl must reference txHash',
  path: ['explorerUrl']
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
