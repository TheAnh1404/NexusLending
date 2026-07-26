import { Router } from 'express';
import { analyticsRouter } from '../modules/analytics/analytics.routes.js';
import { faucetRouter } from '../modules/faucet/faucet.routes.js';
import { indexerRouter } from '../modules/indexer/indexer.routes.js';
import { loansRouter } from '../modules/loans/loans.routes.js';
import { offersRouter } from '../modules/offers/offers.routes.js';
import { oracleRouter } from '../modules/oracle/oracle.routes.js';
import { transactionsRouter } from '../modules/transactions/transactions.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';

export const apiRouter = Router();

apiRouter.use('/users', usersRouter);
apiRouter.use('/offers', offersRouter);
apiRouter.use('/loans', loansRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/oracle', oracleRouter);
apiRouter.use('/indexer', indexerRouter);
apiRouter.use('/transactions', transactionsRouter);
apiRouter.use('/faucet', faucetRouter);

