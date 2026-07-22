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
};

export const USDC_ASSET_CODE = import.meta.env.VITE_USDC_ASSET_CODE ?? 'USDC';
export const USDC_ISSUER = (import.meta.env.VITE_USDC_ISSUER ?? '').trim();
export const USDC_ASSET = USDC_ISSUER ? new Asset(USDC_ASSET_CODE, USDC_ISSUER) : undefined;

export const ASSET_CONTRACTS: Record<string, string> = {
  XLM: import.meta.env.VITE_XLM_CONTRACT_ID || Asset.native().contractId(NETWORK_PASSPHRASE),
  USDC: import.meta.env.VITE_USDC_CONTRACT_ID || USDC_ASSET?.contractId(NETWORK_PASSPHRASE) || '',
};

export const requireUsdcAsset = (): Asset => {
  if (!USDC_ASSET) {
    throw new Error('Missing USDC issuer. Set VITE_USDC_ISSUER for Horizon trustlines and classic DEX swaps, or configure a supported USDC asset.');
  }
  return USDC_ASSET;
};

export const resolveAssetContractId = (asset: string): string => {
  if (StrKey.isValidContract(asset)) return asset;

  const contractId = ASSET_CONTRACTS[asset.toUpperCase()];
  if (!contractId) {
    throw new Error(`Missing Soroban asset contract for ${asset}. Set VITE_${asset.toUpperCase()}_CONTRACT_ID or VITE_USDC_ISSUER.`);
  }
  return contractId;
};
