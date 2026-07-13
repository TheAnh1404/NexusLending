import { Router } from 'express';

import { analyticsRouter } from '../modules/analytics/analytics.routes';
import { loansRouter } from '../modules/loans/loans.routes';
import { offersRouter } from '../modules/offers/offers.routes';
import { oracleRouter } from '../modules/oracle/oracle.routes';
import { indexerRouter } from '../modules/indexer/indexer.routes';
import { transactionsRouter } from '../modules/transactions/transactions.routes';
import { usersRouter } from '../modules/users/users.routes';

export const apiRouter = Router();

apiRouter.use('/users', usersRouter);
apiRouter.use('/offers', offersRouter);
apiRouter.use('/loans', loansRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/oracle', oracleRouter);
apiRouter.use('/indexer', indexerRouter);
apiRouter.use('/transactions', transactionsRouter);
