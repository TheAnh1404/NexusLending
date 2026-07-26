import { Router } from 'express';

import { asyncHandler } from '../../utils/asyncHandler.js';
import { indexerService } from './indexer.service.js';

export const indexerRouter = Router();

indexerRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const status = await indexerService.getStatus();
    res.json({ data: status });
  })
);
