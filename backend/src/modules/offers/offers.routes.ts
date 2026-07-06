import { Router } from 'express';

import { validateBody } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { serialize } from '../../utils/serialize';
import {
  acceptOfferSchema,
  createOfferSchema,
  offerActionWalletSchema,
  updateOfferStatusSchema
} from './offers.schemas';
import { offersService } from './offers.service';

export const offersRouter = Router();

offersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const offers = await offersService.list({
      status: req.query.status?.toString(),
      lenderWallet: req.query.lenderWallet?.toString(),
      marketplaceOnly: req.query.marketplaceOnly === 'true'
    });
    res.json({ data: serialize(offers) });
  })
);

offersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const offer = await offersService.getById(req.params.id as string);
    res.json({ data: serialize(offer) });
  })
);

offersRouter.post(
  '/',
  validateBody(createOfferSchema),
  asyncHandler(async (req, res) => {
    const offer = await offersService.create(req.body);
    res.status(201).json({ data: serialize(offer) });
  })
);

offersRouter.post(
  '/:id/fund',
  validateBody(offerActionWalletSchema),
  asyncHandler(async (req, res) => {
    const offer = await offersService.fund(req.params.id as string, req.body);
    res.json({ data: serialize(offer) });
  })
);

offersRouter.post(
  '/:id/activate',
  validateBody(offerActionWalletSchema),
  asyncHandler(async (req, res) => {
    const offer = await offersService.activate(req.params.id as string, req.body);
    res.json({ data: serialize(offer) });
  })
);

offersRouter.post(
  '/:id/cancel',
  validateBody(offerActionWalletSchema),
  asyncHandler(async (req, res) => {
    const offer = await offersService.cancel(req.params.id as string, req.body);
    res.json({ data: serialize(offer) });
  })
);

offersRouter.post(
  '/:id/expire',
  asyncHandler(async (req, res) => {
    const offer = await offersService.expire(req.params.id as string);
    res.json({ data: serialize(offer) });
  })
);

offersRouter.post(
  '/:id/accept',
  validateBody(acceptOfferSchema),
  asyncHandler(async (req, res) => {
    const loan = await offersService.accept(req.params.id as string, req.body);
    res.status(201).json({ data: serialize(loan) });
  })
);

offersRouter.patch(
  '/:id/status',
  validateBody(updateOfferStatusSchema),
  asyncHandler(async (req, res) => {
    const offer = await offersService.updateStatus(req.params.id as string, req.body);
    res.json({ data: serialize(offer) });
  })
);
