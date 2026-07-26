export interface FaucetAssetConfig {
  code: string;
  displayName: string;
  type: 'native' | 'soroban_token' | 'custom_asset';
  contractId?: string;
  issuer?: string;
  decimals: number;
  claimAmount: string;
  dailyLimit: number;
  cooldownSeconds: number;
  description: string;
  usage: string;
  enabled: boolean;
  icon: string;
}

const USDC_ISSUER = process.env.USDC_ISSUER ?? process.env.VITE_USDC_ISSUER ?? 'GBP45VXHLS7MB72Q3WMTDXRKGHGCALENPTQ2VE7IRQH6MLJZ3X5LN3GG';
const COLLATERAL_ISSUER = process.env.COLLATERAL_ISSUER ?? '';
const USDC_CONTRACT_ID = process.env.USDC_CONTRACT_ID ?? process.env.VITE_USDC_CONTRACT_ID ?? 'CBKAJFOAI5KIOMIPDXYBK3HBPWKFXIEQ564TKM4TMI7P6NU33WIVQYJT';
const COLLATERAL_CONTRACT_ID = process.env.COLLATERAL_CONTRACT_ID ?? '';

export const faucetAssetAllowlist: FaucetAssetConfig[] = [
  {
    code: 'XLM',
    displayName: 'Stellar Lumens (XLM)',
    type: 'native',
    decimals: 7,
    claimAmount: '100',
    dailyLimit: 5,
    cooldownSeconds: 43200, // 12 hours
    description: 'Native utility asset used for Stellar transaction fees and base account balance.',
    usage: 'Stellar network transaction fees & base reserve',
    enabled: true,
    icon: 'XLM',
  },
  {
    code: 'USDC',
    displayName: 'Test USDC (Stablecoin)',
    type: USDC_CONTRACT_ID ? 'soroban_token' : (USDC_ISSUER ? 'custom_asset' : 'soroban_token'),
    contractId: USDC_CONTRACT_ID,
    issuer: USDC_ISSUER || undefined,
    decimals: 7,
    claimAmount: '1000',
    dailyLimit: 3,
    cooldownSeconds: 43200, // 12 hours
    description: 'Testnet USD stablecoin used as primary principal liquidity for lending & borrowing.',
    usage: 'Lending, borrowing principal & loan repayment',
    enabled: Boolean(USDC_ISSUER || USDC_CONTRACT_ID),
    icon: 'USDC',
  },
  {
    code: 'COLLATERAL',
    displayName: 'Test Collateral Token',
    type: COLLATERAL_CONTRACT_ID ? 'soroban_token' : (COLLATERAL_ISSUER ? 'custom_asset' : 'soroban_token'),
    contractId: COLLATERAL_CONTRACT_ID,
    issuer: COLLATERAL_ISSUER || undefined,
    decimals: 7,
    claimAmount: '500',
    dailyLimit: 3,
    cooldownSeconds: 43200, // 12 hours
    description: 'Testnet collateral asset used to secure non-custodial loans on Nexus.',
    usage: 'Securing a Nexus loan in escrow vault',
    enabled: Boolean(COLLATERAL_ISSUER || COLLATERAL_CONTRACT_ID),
    icon: 'COLLATERAL',
  },
];

