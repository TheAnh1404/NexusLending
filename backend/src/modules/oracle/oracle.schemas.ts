import { z } from 'zod';

const decimalInput = z.union([z.string().min(1), z.number()]).transform(String);

export const upsertOraclePriceSchema = z.object({
  assetPair: z.string().min(1),
  baseAsset: z.string().min(1).optional(),
  quoteAsset: z.string().min(1).optional(),
  price: decimalInput.refine((value) => Number(value) > 0, 'price must be greater than zero'),
  decimals: z.coerce.number().int().nonnegative().max(18),
  source: z.string().min(1),
  updatedAt: z.coerce.date().optional(),
  wallet: z.string().min(1).optional()
});

export type UpsertOraclePriceInput = z.infer<typeof upsertOraclePriceSchema>;
