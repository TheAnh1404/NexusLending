import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FaucetService, faucetService } from './faucet.service.js';

describe('FaucetService Unit Tests', () => {
  it('should validate valid Stellar public keys', () => {
    const validAddress = 'GDW5NJOOGRWNRJQ6XWWIN4X5OQGWIHUI2ZJEMQUTOEUCXMEHARXH2NXI';
    assert.doesNotThrow(() => faucetService.validateWalletAddress(validAddress));
  });

  it('should reject secret seeds', () => {
    const secretKey = 'SAUFMVRTKXHWDQSETFQGHS2B6GZNZ4P254NXJI5I6SGXIWMIQI7GKQBK';
    assert.throws(() => faucetService.validateWalletAddress(secretKey), /Never enter a secret key/);
  });

  it('should reject invalid address strings', () => {
    assert.throws(() => faucetService.validateWalletAddress('invalid_address'), /Invalid wallet address/);
  });

  it('should return valid config with network rules', () => {
    const config = faucetService.getConfig();
    assert.equal(config.network, 'testnet');
    assert.ok(Array.isArray(config.assets));
    assert.ok(config.assets.some((a) => a.code === 'USDC'));
  });

  it('should evaluate eligibility for new wallet address', () => {
    faucetService.resetLedger();
    const validAddress = 'GDW5NJOOGRWNRJQ6XWWIN4X5OQGWIHUI2ZJEMQUTOEUCXMEHARXH2NXI';
    const eligibility = faucetService.checkEligibility(validAddress, 'USDC');
    assert.equal(eligibility.eligible, true);
  });
});
