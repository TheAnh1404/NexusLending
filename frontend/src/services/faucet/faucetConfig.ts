import { ASSET_CONTRACTS, STELLAR_DECIMALS, USDC_ASSET_CODE, isValidContractId } from '../soroban/config';

export interface FaucetAsset {
  code: string;
  displayName: string;
  type: 'native' | 'soroban_token' | 'custom_asset';
  contractId?: string;
  decimals: number;
  claimAmount: string;
  dailyLimit: number;
  cooldownSeconds: number;
  description: string;
  usage: string;
  enabled: boolean;
  icon: 'XLM' | 'USDC' | 'COLLATERAL';
}

export const faucetAssets: FaucetAsset[] = [
  {
    code: 'XLM',
    displayName: 'Stellar Lumens (XLM)',
    type: 'native',
    contractId: ASSET_CONTRACTS.XLM,
    decimals: STELLAR_DECIMALS,
    claimAmount: '100',
    dailyLimit: 5,
    cooldownSeconds: 43200, // 12 hours
    description: 'Native Stellar token used for paying transaction fees and base account reserve.',
    usage: 'Stellar network transaction fees & account setup',
    enabled: true,
    icon: 'XLM',
  },
  {
    code: USDC_ASSET_CODE,
    displayName: 'Test USDC (Stablecoin)',
    type: 'soroban_token',
    contractId: ASSET_CONTRACTS.USDC,
    decimals: STELLAR_DECIMALS,
    claimAmount: '1000',
    dailyLimit: 3,
    cooldownSeconds: 43200, // 12 hours
    description: 'USD stablecoin used for funding lending offers, borrowing principal, and paying back loans.',
    usage: 'Lending, borrowing & repayment',
    enabled: isValidContractId(ASSET_CONTRACTS.USDC),
    icon: 'USDC',
  },
  {
    code: 'COLLATERAL',
    displayName: 'Test Collateral Token',
    type: 'soroban_token',
    contractId: ASSET_CONTRACTS.COLLATERAL,
    decimals: STELLAR_DECIMALS,
    claimAmount: '500',
    dailyLimit: 3,
    cooldownSeconds: 43200, // 12 hours
    description: 'Testnet collateral asset used to secure non-custodial loans in Soroban vault escrow.',
    usage: 'Securing a Nexus loan in smart escrow',
    enabled: isValidContractId(ASSET_CONTRACTS.COLLATERAL),
    icon: 'COLLATERAL',
  },
];
