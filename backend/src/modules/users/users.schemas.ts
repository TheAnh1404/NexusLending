import { z } from 'zod';

export const createUserSchema = z.object({
  wallet: z.string().min(1),
  role: z.enum(['LENDER', 'BORROWER', 'LIQUIDATOR']).optional(),
  displayName: z.string().min(1).optional()
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

