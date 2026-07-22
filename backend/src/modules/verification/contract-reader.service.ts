import {
  Account,
  Contract,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { env } from '../../config/env';
import { VerificationError } from './verification.errors';

interface RpcClient {
  getAccount(accountId: string): Promise<{ sequenceNumber(): string }>;
  simulateTransaction(tx: unknown): Promise<unknown>;
}

export interface OnChainOffer {
  offerId: string;
  lender: string;
  loanAsset: string;
  loanAmount: string;
  fixedAprBps: number;
  durationDays: number;
  collateralAsset: string;
  maxLtvBps: number;
  liquidationThresholdBps: number;
  liquidationBonusBps: number;
  gracePeriodDays: number;
  minHealthFactorBps: number;
  status: string;
}

export interface OnChainLoan {
  loanId: string;
  offerId: string;
  lender: string;
  borrower: string;
  loanAsset: string;
  principal: string;
  outstandingDebt: string;
  fixedAprBps: number;
  durationDays: number;
  collateralAsset: string;
  collateralAmount: string;
  startTime: number;
  dueTime: number;
  maxLtvBps: number;
  liquidationThresholdBps: number;
  liquidationBonusBps: number;
  minHealthFactorBps: number;
  gracePeriodDays: number;
  status: string;
}

export interface OnChainLoanRisk {
  healthFactorBps: number;
  ltvBps: number;
  healthFactor: string;
  ltv: string;
}

const CONTRACT_DECIMALS = 7;
const HF_BPS_DENOMINATOR = 10_000n;
const LTV_BPS_DENOMINATOR = 100n;
const DISPLAY_MAX_HEALTH_FACTOR_BPS = 999_900n;

const toU64 = (value: string | number | bigint) => nativeToScVal(BigInt(value), { type: 'u64' });

const toAddressString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toString' in value) {
    return String((value as { toString(): string }).toString());
  }
  return String(value ?? '');
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return Number(value ?? 0);
};

const toIntegerString = (value: unknown): string => {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  return String(value ?? '0');
};

const fromContractAmount = (value: unknown): string => {
  const raw = BigInt(toIntegerString(value));
  const scale = 10n ** BigInt(CONTRACT_DECIMALS);
  const whole = raw / scale;
  const fraction = raw % scale;
  const fractionText = fraction.toString().padStart(CONTRACT_DECIMALS, '0').replace(/0+$/, '');
  return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
};

const scaledRatioToString = (value: unknown, denominator: bigint): string => {
  let raw = BigInt(toIntegerString(value));
  if (denominator === HF_BPS_DENOMINATOR && raw > DISPLAY_MAX_HEALTH_FACTOR_BPS) {
    raw = DISPLAY_MAX_HEALTH_FACTOR_BPS;
  }
  const whole = raw / denominator;
  const fraction = raw % denominator;
  const width = denominator.toString().length - 1;
  const fractionText = fraction.toString().padStart(width, '0').replace(/0+$/, '');
  return fractionText ? `${whole.toString()}.${fractionText}` : whole.toString();
};

const readField = (value: Record<string, unknown>, snake: string, camel: string): unknown =>
  value[snake] ?? value[camel];

export class ContractReaderService {
  private readonly rpcClient: RpcClient;

  constructor(rpcClient?: RpcClient) {
    this.rpcClient = rpcClient ?? new rpc.Server(env.stellarRpcUrl || 'https://soroban-testnet.stellar.org:443') as unknown as RpcClient;
  }

  async readOffer(offerId: string | number | bigint, sourceAccount?: string): Promise<OnChainOffer> {
    const native = await this.simulateRead(env.marketplaceContractId, 'get_offer', [toU64(offerId)], sourceAccount);
    const value = native as Record<string, unknown>;

    return {
      offerId: toIntegerString(readField(value, 'offer_id', 'offerId')),
      lender: toAddressString(readField(value, 'lender', 'lender')),
      loanAsset: toAddressString(readField(value, 'loan_asset', 'loanAsset')),
      loanAmount: fromContractAmount(readField(value, 'loan_amount', 'loanAmount')),
      fixedAprBps: toNumber(readField(value, 'fixed_apr_bps', 'fixedAprBps')),
      durationDays: toNumber(readField(value, 'duration_days', 'durationDays')),
      collateralAsset: toAddressString(readField(value, 'collateral_asset', 'collateralAsset')),
      maxLtvBps: toNumber(readField(value, 'max_ltv_bps', 'maxLtvBps')),
      liquidationThresholdBps: toNumber(readField(value, 'liquidation_threshold_bps', 'liquidationThresholdBps')),
      liquidationBonusBps: toNumber(readField(value, 'liquidation_bonus_bps', 'liquidationBonusBps')),
      gracePeriodDays: toNumber(readField(value, 'grace_period_days', 'gracePeriodDays')),
      minHealthFactorBps: toNumber(readField(value, 'min_health_factor_bps', 'minHealthFactorBps')),
      status: toAddressString(readField(value, 'status', 'status')),
    };
  }

  async readLoan(loanId: string | number | bigint, sourceAccount?: string): Promise<OnChainLoan> {
    const native = await this.simulateRead(env.loanManagerContractId, 'get_loan', [toU64(loanId)], sourceAccount);
    const value = native as Record<string, unknown>;

    return {
      loanId: toIntegerString(readField(value, 'loan_id', 'loanId')),
      offerId: toIntegerString(readField(value, 'offer_id', 'offerId')),
      lender: toAddressString(readField(value, 'lender', 'lender')),
      borrower: toAddressString(readField(value, 'borrower', 'borrower')),
      loanAsset: toAddressString(readField(value, 'loan_asset', 'loanAsset')),
      principal: fromContractAmount(readField(value, 'principal', 'principal')),
      outstandingDebt: fromContractAmount(readField(value, 'outstanding_debt', 'outstandingDebt')),
      fixedAprBps: toNumber(readField(value, 'fixed_apr_bps', 'fixedAprBps')),
      durationDays: toNumber(readField(value, 'duration_days', 'durationDays')),
      collateralAsset: toAddressString(readField(value, 'collateral_asset', 'collateralAsset')),
      collateralAmount: fromContractAmount(readField(value, 'collateral_amount', 'collateralAmount')),
      startTime: toNumber(readField(value, 'start_time', 'startTime')),
      dueTime: toNumber(readField(value, 'due_time', 'dueTime')),
      maxLtvBps: toNumber(readField(value, 'max_ltv_bps', 'maxLtvBps')),
      liquidationThresholdBps: toNumber(readField(value, 'liquidation_threshold_bps', 'liquidationThresholdBps')),
      liquidationBonusBps: toNumber(readField(value, 'liquidation_bonus_bps', 'liquidationBonusBps')),
      minHealthFactorBps: toNumber(readField(value, 'min_health_factor_bps', 'minHealthFactorBps')),
      gracePeriodDays: toNumber(readField(value, 'grace_period_days', 'gracePeriodDays')),
      status: toAddressString(readField(value, 'status', 'status')),
    };
  }

  async readLoanRisk(loanId: string | number | bigint, sourceAccount?: string): Promise<OnChainLoanRisk> {
    const args = [toU64(loanId)];
    const [healthFactorBps, ltvBps] = await Promise.all([
      this.simulateRead(env.loanManagerContractId, 'calculate_health_factor', args, sourceAccount),
      this.simulateRead(env.loanManagerContractId, 'calculate_ltv', args, sourceAccount),
    ]);

    return {
      healthFactorBps: toNumber(healthFactorBps),
      ltvBps: toNumber(ltvBps),
      healthFactor: scaledRatioToString(healthFactorBps, HF_BPS_DENOMINATOR),
      ltv: scaledRatioToString(ltvBps, LTV_BPS_DENOMINATOR),
    };
  }

  private async simulateRead(
    contractId: string,
    functionName: string,
    args: ReturnType<typeof nativeToScVal>[],
    sourceAccount?: string,
  ): Promise<unknown> {
    const source = sourceAccount || env.stellarReadSourceAccount;
    if (!source) {
      throw new VerificationError('STELLAR_READ_SOURCE_ACCOUNT is required for contract state verification when no event actor is available');
    }

    const accountResponse = await this.rpcClient.getAccount(source);
    const account = new Account(source, accountResponse.sequenceNumber());
    const contract = new Contract(contractId);
    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: env.stellarNetworkPassphrase,
    })
      .addOperation(contract.call(functionName, ...args))
      .setTimeout(180)
      .build();

    const simulated = await this.rpcClient.simulateTransaction(tx) as Record<string, unknown>;
    if (rpc.Api.isSimulationError(simulated as never)) {
      throw new VerificationError(`Unable to read ${functionName} from ${contractId}: ${String((simulated as { error?: unknown }).error ?? 'simulation failed')}`);
    }

    const result = simulated.result as { retval?: unknown } | undefined;
    if (!result?.retval) {
      throw new VerificationError(`Contract read ${functionName} returned no value`);
    }

    return scValToNative(result.retval as never);
  }
}

export const contractReaderService = new ContractReaderService();
