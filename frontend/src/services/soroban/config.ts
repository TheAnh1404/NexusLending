import { Asset, Networks, StrKey } from '@stellar/stellar-sdk';
import testnetDeployments from '../../../../deployments/testnet.json';

export type StellarNetworkName = 'testnet' | 'public' | 'futurenet' | 'standalone';

export const normalizeStellarNetworkName = (network: string | undefined): StellarNetworkName => {
  const normalized = (network ?? 'testnet').trim().toLowerCase();
  if (normalized === 'mainnet' || normalized === 'public') return 'public';
  if (normalized === 'futurenet') return 'futurenet';
  if (normalized === 'standalone' || normalized === 'localnet') return 'standalone';
  return 'testnet';
};

const passphraseForNetwork = (network: StellarNetworkName): string => {
  if (network === 'public') return Networks.PUBLIC;
  if (network === 'futurenet') return Networks.FUTURENET;
  if (network === 'standalone') return Networks.STANDALONE;
  return Networks.TESTNET;
};

export const NETWORK = normalizeStellarNetworkName(import.meta.env.VITE_STELLAR_NETWORK);
export const RPC_URL = import.meta.env.VITE_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org:443';
export const HORIZON_URL = import.meta.env.VITE_STELLAR_HORIZON_URL
  ?? (NETWORK === 'public'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org');
export const NETWORK_PASSPHRASE = import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE
  ?? passphraseForNetwork(NETWORK);
export const PASSPHRASE = NETWORK_PASSPHRASE;
export const EXPLORER_NETWORK = NETWORK === 'public' ? 'public' : 'testnet';
export const NETWORK_DISPLAY_NAME =
  NETWORK === 'public'
    ? 'Stellar Mainnet'
    : NETWORK === 'futurenet'
    ? 'Stellar Futurenet'
    : NETWORK === 'standalone'
    ? 'Stellar Standalone'
    : 'Stellar Testnet';

/** Stellar classic assets use 7 decimal places (stroops). */
export const STELLAR_DECIMALS = 7;

export const CONTRACTS = {
  oracle: import.meta.env.VITE_ORACLE_CONTRACT_ID || testnetDeployments.contracts.oracle,
  vault: import.meta.env.VITE_VAULT_CONTRACT_ID || testnetDeployments.contracts.vault,
  marketplace: import.meta.env.VITE_MARKETPLACE_CONTRACT_ID || testnetDeployments.contracts.marketplace,
  loanManager: import.meta.env.VITE_LOAN_MANAGER_CONTRACT_ID || testnetDeployments.contracts.loanManager,
  faucet: import.meta.env.VITE_FAUCET_CONTRACT_ID || (testnetDeployments.contracts as any).faucet || '',
};

export const USDC_ASSET_CODE = import.meta.env.VITE_USDC_ASSET_CODE ?? 'USDC';
const defaultTestnetUsdcIssuer = NETWORK === 'testnet' ? testnetDeployments.deployer : '';
export const USDC_ISSUER = (import.meta.env.VITE_USDC_ISSUER ?? defaultTestnetUsdcIssuer).trim();
export const USDC_ASSET = StrKey.isValidEd25519PublicKey(USDC_ISSUER)
  ? new Asset(USDC_ASSET_CODE, USDC_ISSUER)
  : undefined;
const configuredUsdcContractId = (import.meta.env.VITE_USDC_CONTRACT_ID ?? '').trim();
const derivedUsdcContractId = USDC_ASSET?.contractId(NETWORK_PASSPHRASE) ?? '';

export const ASSET_CONTRACTS: Record<string, string> = {
  XLM: import.meta.env.VITE_XLM_CONTRACT_ID || Asset.native().contractId(NETWORK_PASSPHRASE),
  USDC: configuredUsdcContractId || derivedUsdcContractId,
  COLLATERAL: import.meta.env.VITE_COLLATERAL_CONTRACT_ID || '',
};

export const USDC_CONFIGURATION_ERROR = configuredUsdcContractId
  && derivedUsdcContractId
  && configuredUsdcContractId !== derivedUsdcContractId
  ? `Configured USDC issuer resolves to ${derivedUsdcContractId}, but VITE_USDC_CONTRACT_ID is ${configuredUsdcContractId}.`
  : null;

export const isValidContractId = (value: string | undefined): value is string =>
  Boolean(value && StrKey.isValidContract(value));

export const requireUsdcAsset = (): Asset => {
  if (!USDC_ASSET) {
    throw new Error('Missing USDC issuer. Set VITE_USDC_ISSUER environment variable for Horizon trustlines and classic DEX swaps.');
  }
  if (USDC_CONFIGURATION_ERROR) {
    throw new Error(`Nexus USDC configuration mismatch. ${USDC_CONFIGURATION_ERROR}`);
  }
  return USDC_ASSET;
};

export const resolveAssetContractId = (asset: string): string => {
  if (StrKey.isValidContract(asset)) return asset;

  const contractId = ASSET_CONTRACTS[asset.toUpperCase()];
  if (!isValidContractId(contractId)) {
    throw new Error(`Missing Soroban asset contract for ${asset}. Set VITE_${asset.toUpperCase()}_CONTRACT_ID or VITE_USDC_ISSUER.`);
  }
  return contractId;
};
