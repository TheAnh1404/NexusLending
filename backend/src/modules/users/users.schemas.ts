import { StrKey } from '@stellar/stellar-sdk';
import { z } from 'zod';

const connectedWalletSchema = z
  .string()
  .trim()
  .refine((wallet) => StrKey.isValidEd25519PublicKey(wallet), {
    message: 'Invalid Stellar wallet address'
  });

export const connectUserSchema = z.object({
  wallet: connectedWalletSchema
});

export const createUserSchema = z.object({
  wallet: z.string().min(1),
  role: z.enum(['LENDER', 'BORROWER', 'LIQUIDATOR']).optional(),
  displayName: z.string().min(1).optional()
});

export type ConnectUserInput = z.infer<typeof connectUserSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
