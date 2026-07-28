import { Router } from 'express';

import { validateBody } from '../../middlewares/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { serialize } from '../../utils/serialize.js';
import { connectUserSchema, createUserSchema } from './users.schemas.js';
import { usersService } from './users.service.js';

export const usersRouter = Router();

usersRouter.post(
  '/connect',
  validateBody(connectUserSchema),
  asyncHandler(async (req, res) => {
    const user = await usersService.findOrCreate(req.body);
    res.json({ data: serialize(user) });
  })
);

usersRouter.get(
  '/:wallet',
  asyncHandler(async (req, res) => {
    const user = await usersService.getByWallet(req.params.wallet as string);
    res.json({ data: serialize(user) });
  })
);

usersRouter.post(
  '/',
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await usersService.create(req.body);
    res.status(201).json({ data: serialize(user) });
  })
);
