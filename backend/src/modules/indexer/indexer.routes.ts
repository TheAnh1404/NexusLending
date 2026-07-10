import { Router } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { indexerService } from './indexer.service';

export const indexerRouter = Router();

indexerRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const status = await indexerService.getStatus();
    res.json({ data: status });
  })
);
