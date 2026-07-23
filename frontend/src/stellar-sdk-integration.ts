/**
 * Stellar Soroban Smart Contract Frontend Integration SDK Wrapper
 * 
 * Provides 1-to-1 function matching between Soroban Rust smart contracts
 * (Marketplace, Loan Manager, Vault, Oracle) and `@stellar/stellar-sdk` client invocations.
 */

import {
  Address,
  Contract,
  Horizon,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';
import { CONTRACTS, HORIZON_URL, RPC_URL } from './services/soroban/config';

export interface ContractOfferTerms {
  loanAsset: string;
  collateralAsset: string;
  principalAmount: bigint;
  minCollateralAmount: bigint;
  aprBps: number;
  durationSeconds: bigint;
  maxLtvBps: number;
  liquidationThresholdBps: number;
  liquidationBonusBps: number;
  minHealthFactorBps: number;
}

export interface ContractLoan {
  loanId: string;
  borrower: string;
  lender: string;
  principal: bigint;
  collateral: bigint;
  status: string;
  healthFactorBps: number;
}

/**
 * Soroban Client Instance leveraging `@stellar/stellar-sdk` RPC Server connection.
 */
export class StellarSorobanIntegration {
  public rpcServer: rpc.Server;
  public horizonServer: Horizon.Server;

  constructor() {
    this.rpcServer = new rpc.Server(RPC_URL);
    this.horizonServer = new Horizon.Server(HORIZON_URL);
  }

  /**
   * 1. Marketplace Contract Integration: `create_offer`
   */
  public async createOffer(lenderPublicKey: string, terms: ContractOfferTerms): Promise<string> {
    const contract = new Contract(CONTRACTS.marketplace);
    
    const args = [
      new Address(lenderPublicKey).toScVal(),
      nativeToScVal(terms.loanAsset),
      nativeToScVal(terms.collateralAsset),
      nativeToScVal(terms.principalAmount, { type: 'i128' }),
      nativeToScVal(terms.minCollateralAmount, { type: 'i128' }),
      nativeToScVal(terms.aprBps, { type: 'u32' }),
      nativeToScVal(terms.durationSeconds, { type: 'u64' }),
      nativeToScVal(terms.maxLtvBps, { type: 'u32' }),
      nativeToScVal(terms.liquidationThresholdBps, { type: 'u32' }),
      nativeToScVal(terms.liquidationBonusBps, { type: 'u32' }),
      nativeToScVal(terms.minHealthFactorBps, { type: 'u32' }),
    ];

    const operation = contract.call('create_offer', ...args);
    return operation.toXDR('base64');
  }

  /**
   * 2. Marketplace Contract Integration: `fund_offer`
   */
  public async fundOffer(offerId: bigint, funderPublicKey: string): Promise<string> {
    const contract = new Contract(CONTRACTS.marketplace);
    const args = [
      nativeToScVal(offerId, { type: 'u64' }),
      new Address(funderPublicKey).toScVal(),
    ];
    return contract.call('fund_offer', ...args).toXDR('base64');
  }

  /**
   * 3. Marketplace Contract Integration: `activate_offer`
   */
  public async activateOffer(offerId: bigint): Promise<string> {
    const contract = new Contract(CONTRACTS.marketplace);
    return contract.call('activate_offer', nativeToScVal(offerId, { type: 'u64' })).toXDR('base64');
  }

  /**
   * 4. Marketplace Contract Integration: `accept_offer`
   */
  public async acceptOffer(
    offerId: bigint,
    borrowerPublicKey: string,
    collateralAmount: bigint
  ): Promise<string> {
    const contract = new Contract(CONTRACTS.marketplace);
    const args = [
      nativeToScVal(offerId, { type: 'u64' }),
      new Address(borrowerPublicKey).toScVal(),
      nativeToScVal(collateralAmount, { type: 'i128' }),
    ];
    return contract.call('accept_offer', ...args).toXDR('base64');
  }

  /**
   * 5. Loan Manager Contract Integration: `activate_loan`
   */
  public async activateLoan(loanId: bigint): Promise<string> {
    const contract = new Contract(CONTRACTS.loanManager);
    return contract.call('activate_loan', nativeToScVal(loanId, { type: 'u64' })).toXDR('base64');
  }

  /**
   * 6. Loan Manager Contract Integration: `full_repay`
   */
  public async fullRepay(loanId: bigint): Promise<string> {
    const contract = new Contract(CONTRACTS.loanManager);
    return contract.call('full_repay', nativeToScVal(loanId, { type: 'u64' })).toXDR('base64');
  }

  /**
   * 7. Loan Manager Contract Integration: `partial_repay`
   */
  public async partialRepay(loanId: bigint, amount: bigint): Promise<string> {
    const contract = new Contract(CONTRACTS.loanManager);
    const args = [
      nativeToScVal(loanId, { type: 'u64' }),
      nativeToScVal(amount, { type: 'i128' }),
    ];
    return contract.call('partial_repay', ...args).toXDR('base64');
  }

  /**
   * 8. Loan Manager Contract Integration: `liquidate`
   */
  public async liquidateLoan(
    loanId: bigint,
    liquidatorPublicKey: string,
    repayAmount: bigint
  ): Promise<string> {
    const contract = new Contract(CONTRACTS.loanManager);
    const args = [
      nativeToScVal(loanId, { type: 'u64' }),
      new Address(liquidatorPublicKey).toScVal(),
      nativeToScVal(repayAmount, { type: 'i128' }),
    ];
    return contract.call('liquidate', ...args).toXDR('base64');
  }

  /**
   * 9. Oracle Contract Integration: `set_price`
   */
  public async setPrice(
    asset: string,
    price: bigint,
    timestamp: bigint
  ): Promise<string> {
    const contract = new Contract(CONTRACTS.oracle);
    const args = [
      nativeToScVal(asset),
      nativeToScVal(price, { type: 'i128' }),
      nativeToScVal(timestamp, { type: 'u64' }),
    ];
    return contract.call('set_price', ...args).toXDR('base64');
  }
}

export const stellarIntegration = new StellarSorobanIntegration();
