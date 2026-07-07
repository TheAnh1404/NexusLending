import { z } from 'zod';

const decimalInput = z.union([z.string().min(1), z.number()]).transform(String);
const txHash = z.string().regex(/^[a-fA-F0-9]{64}$/, 'txHash must be a 64-character Stellar transaction hash');
const stellarExpertUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://stellar.expert/explorer/'), {
    message: 'explorerUrl must be a Stellar Expert URL'
  });

export const confirmedChainReceiptSchema = z.object({
  txHash,
  explorerUrl: stellarExpertUrl,
  ledger: z.coerce.number().int().positive(),
  txStatus: z.literal('SUCCESS'),
  contractId: z.string().min(1).optional(),
  blockTimestamp: z.coerce.date().optional(),
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
  blockTimestamp: z.coerce.date().optional(),
  metadata: z.unknown().optional()
}).refine((input) => input.explorerUrl.endsWith(`/tx/${input.txHash}`), {
  message: 'explorerUrl must reference txHash',
  path: ['explorerUrl']
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
