import { z } from 'zod';

const decimalInput = z.union([z.string().min(1), z.number()]).transform(String);

export const createTransactionSchema = z.object({
  txHash: z.string().min(1),
  explorerUrl: z.string().url().optional(),
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
  status: z.string().default('CONFIRMED'),
  metadata: z.unknown().optional()
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
