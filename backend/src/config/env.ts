import dotenv from 'dotenv';

dotenv.config();

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  port: numberFromEnv(process.env.PORT, 5000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  stellarNetwork: process.env.STELLAR_NETWORK ?? 'testnet',
  stellarRpcUrl: process.env.STELLAR_RPC_URL ?? '',
  marketplaceContractId: process.env.MARKETPLACE_CONTRACT_ID ?? '',
  loanManagerContractId: process.env.LOAN_MANAGER_CONTRACT_ID ?? '',
  oracleContractId: process.env.ORACLE_CONTRACT_ID ?? '',
  vaultContractId: process.env.VAULT_CONTRACT_ID ?? ''
};
