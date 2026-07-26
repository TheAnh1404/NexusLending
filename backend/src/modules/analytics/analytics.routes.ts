import { Router } from 'express';

import { asyncHandler } from '../../utils/asyncHandler.js';
import { serialize } from '../../utils/serialize.js';
import { analyticsService } from './analytics.service.js';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const analytics = await analyticsService.dashboard();
    res.json({ data: serialize(analytics) });
  })
);
