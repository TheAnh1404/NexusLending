import { Router } from 'express';

import { validateBody } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { serialize } from '../../utils/serialize.js';
import { upsertOraclePriceSchema } from './oracle.schemas.js';
import { oracleService } from './oracle.service.js';

export const oracleRouter = Router();

oracleRouter.get(
  '/prices',
  asyncHandler(async (_req, res) => {
    const prices = await oracleService.list();
    res.json({ data: serialize(prices) });
  })
);

oracleRouter.post(
  '/prices',
  validateBody(upsertOraclePriceSchema),
  asyncHandler(async (req, res) => {
    const price = await oracleService.upsert(req.body);
    res.status(201).json({ data: serialize(price) });
  })
);

oracleRouter.post(
  '/recalculate-health',
  asyncHandler(async (_req, res) => {
    const loans = await oracleService.recalculateHealth();
    res.json({ data: serialize({ updatedCount: loans.length, loans }) });
  })
);

