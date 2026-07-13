import { Router } from 'express';

import { asyncHandler } from '../../utils/asyncHandler';
import { serialize } from '../../utils/serialize';
import { analyticsService } from './analytics.service';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const analytics = await analyticsService.dashboard();
    res.json({ data: serialize(analytics) });
  })
);
