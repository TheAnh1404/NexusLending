import { Router } from 'express';

import { validateBody } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { serialize } from '../../utils/serialize';
import { activateLoanSchema, createLoanSchema, syncLoanSchema, updateLoanSchema } from './loans.schemas';
import { loansService } from './loans.service';

export const loansRouter = Router();

loansRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const loans = await loansService.list({
      status: req.query.status?.toString(),
      borrowerWallet: req.query.borrowerWallet?.toString(),
      lenderWallet: req.query.lenderWallet?.toString(),
      riskZone: req.query.riskZone?.toString()
    });
    res.json({ data: serialize(loans) });
  })
);

loansRouter.get(
  '/liquidatable',
  asyncHandler(async (_req, res) => {
    const loans = await loansService.liquidatable();
    res.json({ data: serialize(loans) });
  })
);

loansRouter.post(
  '/recover-chain',
  validateBody(syncLoanSchema),
  asyncHandler(async (req, res) => {
    const report = await loansService.recoverChain(req.body);
    res.json({ data: serialize(report) });
  })
);

loansRouter.post(
  '/:id/activate',
  validateBody(activateLoanSchema),
  asyncHandler(async (req, res) => {
    const loan = await loansService.activate(req.params.id as string, req.body);
    res.json({ data: serialize(loan) });
  })
);

loansRouter.post(
  '/:id/sync-chain',
  validateBody(syncLoanSchema),
  asyncHandler(async (req, res) => {
    const loan = await loansService.syncChain(req.params.id as string, req.body);
    res.json({ data: serialize(loan) });
  })
);

loansRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const loan = await loansService.getById(req.params.id as string);
    res.json({ data: serialize(loan) });
  })
);

loansRouter.post(
  '/',
  validateBody(createLoanSchema),
  asyncHandler(async (req, res) => {
    const loan = await loansService.create(req.body);
    res.status(201).json({ data: serialize(loan) });
  })
);

loansRouter.patch(
  '/:id',
  validateBody(updateLoanSchema),
  asyncHandler(async (req, res) => {
    const loan = await loansService.update(req.params.id as string, req.body);
    res.json({ data: serialize(loan) });
  })
);
