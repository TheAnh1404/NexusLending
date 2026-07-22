import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export type StellarNetworkName = 'testnet' | 'public' | 'futurenet' | 'standalone';

export const normalizeStellarNetworkName = (network: string | undefined): StellarNetworkName => {
  const normalized = (network ?? 'testnet').trim().toLowerCase();
  if (normalized === 'mainnet' || normalized === 'public') return 'public';
  if (normalized === 'futurenet') return 'futurenet';
  if (normalized === 'standalone' || normalized === 'localnet') return 'standalone';
  return 'testnet';
};

export const passphraseForNetwork = (network: StellarNetworkName): string => {
  if (network === 'public') return 'Public Global Stellar Network ; September 2015';
  if (network === 'futurenet') return 'Test SDF Future Network ; October 2022';
  if (network === 'standalone') return 'Standalone Network ; February 2017';
  return 'Test SDF Network ; September 2015';
};

const stellarNetwork = normalizeStellarNetworkName(process.env.STELLAR_NETWORK);

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  port: numberFromEnv(process.env.PORT, 5000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  stellarNetwork,
  stellarNetworkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE ?? passphraseForNetwork(stellarNetwork),
  stellarRpcUrl: process.env.STELLAR_RPC_URL ?? '',
  stellarReadSourceAccount: process.env.STELLAR_READ_SOURCE_ACCOUNT ?? '',
  marketplaceContractId: process.env.MARKETPLACE_CONTRACT_ID ?? '',
  loanManagerContractId: process.env.LOAN_MANAGER_CONTRACT_ID ?? '',
  oracleContractId: process.env.ORACLE_CONTRACT_ID ?? '',
  vaultContractId: process.env.VAULT_CONTRACT_ID ?? ''
};
