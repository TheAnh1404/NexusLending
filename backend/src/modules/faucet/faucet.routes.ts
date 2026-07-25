import { Router } from 'express';
import { faucetController } from './faucet.controller';

export const faucetRouter = Router();

faucetRouter.get('/config', faucetController.getConfig);
faucetRouter.get('/eligibility', faucetController.getEligibility);
faucetRouter.post('/request', faucetController.requestTokens);
faucetRouter.post('/reset', faucetController.resetLedger);
