import { env } from '../../config/env';

type ContractName = 'marketplace' | 'loanManager' | 'oracle';

interface ContractCallTx {
  txHash: string;
  explorerUrl: string;
  mocked: true;
  unsignedXdr: null;
  contract: ContractName;
  contractId: string;
  functionName: string;
  args: object;
  network: string;
  note: string;
}

interface CreateOfferTxInput {
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
}

interface AcceptOfferTxInput {
  offerId: bigint | number | string;
  borrower: string;
  collateralAmount: string;
}

interface LoanAmountTxInput {
  loanId: bigint | number | string;
  amount: string;
}

interface LiquidateTxInput extends LoanAmountTxInput {
  liquidator: string;
}

interface UpdateOraclePriceTxInput {
  baseAsset?: string;
  quoteAsset?: string;
  assetPair: string;
  price: string;
  decimals: number;
  source: string;
}

interface RawContractEvent {
  id?: string;
  contractId?: string;
  topic?: unknown;
  topics?: unknown[];
  value?: unknown;
  ledger?: number;
}

interface IndexedEventMapping {
  eventName: string;
  entity: 'offer' | 'loan' | 'oracle' | 'unknown';
  action: string;
  event: RawContractEvent;
}

const contractIds: Record<ContractName, string> = {
  marketplace: env.marketplaceContractId,
  loanManager: env.loanManagerContractId,
  oracle: env.oracleContractId
};

const eventActionMap: Record<string, Omit<IndexedEventMapping, 'eventName' | 'event'>> = {
  offer_created: { entity: 'offer', action: 'create' },
  offer_funded: { entity: 'offer', action: 'fund' },
  offer_activated: { entity: 'offer', action: 'activate' },
  offer_matched: { entity: 'offer', action: 'match' },
  loan_created: { entity: 'loan', action: 'create_pending' },
  loan_activated: { entity: 'loan', action: 'activate' },
  loan_state_updated: { entity: 'loan', action: 'refresh_state' },
  loan_liquidated: { entity: 'loan', action: 'liquidate' },
  price_updated: { entity: 'oracle', action: 'update_price' }
};

const explorerUrlFor = (txHash: string): string =>
  env.stellarNetwork === 'testnet'
    ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
    : `https://stellar.expert/explorer/public/tx/${txHash}`;

const mockTx = (
  action: string,
  contract: ContractName,
  functionName: string,
  args: object
): ContractCallTx => {
  const txHash = `mock-${action}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return {
    txHash,
    explorerUrl: explorerUrlFor(txHash),
    mocked: true,
    unsignedXdr: null,
    contract,
    contractId: contractIds[contract],
    functionName,
    args,
    network: env.stellarNetwork,
    note:
      'Mock Soroban transaction envelope. Real unsigned XDR assembly is pending deployed contract IDs and backend Stellar SDK wiring.'
  };
};

const extractEventName = (event: RawContractEvent): string => {
  const topics = event.topics ?? (Array.isArray(event.topic) ? event.topic : [event.topic]);
  const firstTopic = topics.find((topic) => topic !== undefined);
  if (typeof firstTopic === 'string') return firstTopic;
  if (firstTopic && typeof firstTopic === 'object' && 'value' in firstTopic) {
    const value = (firstTopic as { value?: unknown }).value;
    return typeof value === 'string' ? value : 'unknown';
  }
  return 'unknown';
};

export const sorobanService = {
  createOfferTx(input: CreateOfferTxInput) {
    return mockTx('create-offer', 'marketplace', 'create_offer', input);
  },

  fundOfferTx(offerId: bigint | number | string) {
    return mockTx('fund-offer', 'marketplace', 'fund_offer', { offerId });
  },

  activateOfferTx(offerId: bigint | number | string) {
    return mockTx('activate-offer', 'marketplace', 'activate_offer', { offerId });
  },

  acceptOfferTx(input: AcceptOfferTxInput) {
    return mockTx('accept-offer', 'marketplace', 'accept_offer', input);
  },

  activateLoanTx(loanId: bigint | number | string) {
    return mockTx('activate-loan', 'loanManager', 'activate_loan', { loanId });
  },

  addCollateralTx(input: LoanAmountTxInput) {
    return mockTx('add-collateral', 'loanManager', 'add_collateral', input);
  },

  partialRepayTx(input: LoanAmountTxInput) {
    return mockTx('partial-repay', 'loanManager', 'partial_repay', input);
  },

  fullRepayTx(loanId: bigint | number | string) {
    return mockTx('full-repay', 'loanManager', 'full_repay', { loanId });
  },

  updateOraclePriceTx(input: UpdateOraclePriceTxInput) {
    const functionName = input.baseAsset && input.quoteAsset ? 'set_price_for_assets' : 'set_price';
    return mockTx('update-oracle-price', 'oracle', functionName, input);
  },

  liquidateTx(input: LiquidateTxInput) {
    return mockTx('liquidate', 'loanManager', 'liquidate', input);
  },

  mapContractEvent(event: RawContractEvent): IndexedEventMapping {
    const eventName = extractEventName(event);
    const mapping = eventActionMap[eventName] ?? { entity: 'unknown' as const, action: 'ignore' };
    return { eventName, event, ...mapping };
  },

  async fetchContractEvents(): Promise<IndexedEventMapping[]> {
    return [];
  },

  async submitCreateOfferTx(input: CreateOfferTxInput) {
    return this.createOfferTx(input);
  },

  async submitAcceptOfferTx(input: AcceptOfferTxInput) {
    return this.acceptOfferTx(input);
  },

  async submitAddCollateralTx(input: LoanAmountTxInput) {
    return this.addCollateralTx(input);
  },

  async submitPartialRepayTx(input: LoanAmountTxInput) {
    return this.partialRepayTx(input);
  },

  async submitLiquidationTx(input: LiquidateTxInput) {
    return this.liquidateTx(input);
  }
};
