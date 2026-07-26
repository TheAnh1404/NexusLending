import type { Request, Response } from 'express';
import { faucetService } from './faucet.service.js';

export const faucetController = {
  getConfig(_req: Request, res: Response): void {
    const config = faucetService.getConfig();
    res.json({ data: config });
  },

  getEligibility(req: Request, res: Response): void {
    try {
      const { walletAddress, asset } = req.query;

      if (!walletAddress || typeof walletAddress !== 'string') {
        res.status(400).json({ error: { message: 'Query parameter walletAddress is required.' } });
        return;
      }

      if (!asset || typeof asset !== 'string') {
        res.status(400).json({ error: { message: 'Query parameter asset is required.' } });
        return;
      }

      const status = faucetService.checkEligibility(walletAddress, asset);
      res.json({ data: status });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check eligibility';
      res.status(400).json({ error: { message } });
    }
  },

  async requestTokens(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress, asset, idempotencyKey } = req.body || {};

      if (!walletAddress) {
        res.status(400).json({ error: { message: 'Field walletAddress is required.' } });
        return;
      }

      if (!asset) {
        res.status(400).json({ error: { message: 'Field asset is required.' } });
        return;
      }

      const result = await faucetService.requestTokens({
        walletAddress: String(walletAddress),
        asset: String(asset),
        idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
      });

      res.status(200).json({ data: result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process faucet request';
      res.status(400).json({ error: { message } });
    }
  },

  resetLedger(_req: Request, res: Response): void {
    faucetService.resetLedger();
    res.json({
      data: {
        success: true,
        message: 'Faucet records reset successfully. All cooldowns and rate limits cleared.',
      },
    });
  },
};
