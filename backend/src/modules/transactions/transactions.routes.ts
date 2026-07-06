import { Router } from 'express';

import { validateBody } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { serialize } from '../../utils/serialize';
import { createTransactionSchema } from './transactions.schemas';
import { transactionsService } from './transactions.service';

export const transactionsRouter = Router();

transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const transactions = await transactionsService.list({
      wallet: req.query.wallet?.toString(),
      type: req.query.type?.toString(),
      loanId: req.query.loanId?.toString(),
      offerId: req.query.offerId?.toString()
    });
    res.json({ data: serialize(transactions) });
  })
);

transactionsRouter.post(
  '/',
  validateBody(createTransactionSchema),
  asyncHandler(async (req, res) => {
    const transaction = await transactionsService.create(req.body);
    res.status(201).json({ data: serialize(transaction) });
  })
);

