import { Asset, StrKey } from '@stellar/stellar-sdk';
import testnetDeployments from '../../../../deployments/testnet.json';

export const NETWORK = import.meta.env.VITE_STELLAR_NETWORK ?? 'testnet';
export const RPC_URL = import.meta.env.VITE_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org:443';
export const HORIZON_URL = import.meta.env.VITE_STELLAR_HORIZON_URL
  ?? (NETWORK === 'mainnet' || NETWORK === 'public'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org');
export const PASSPHRASE = 'Test SDF Network ; September 2015';

/** Stellar classic assets use 7 decimal places (stroops). */
export const STELLAR_DECIMALS = 7;

export const CONTRACTS = {
  oracle: import.meta.env.VITE_ORACLE_CONTRACT_ID || testnetDeployments.contracts.oracle,
  vault: import.meta.env.VITE_VAULT_CONTRACT_ID || testnetDeployments.contracts.vault,
  marketplace: import.meta.env.VITE_MARKETPLACE_CONTRACT_ID || testnetDeployments.contracts.marketplace,
  loanManager: import.meta.env.VITE_LOAN_MANAGER_CONTRACT_ID || testnetDeployments.contracts.loanManager,
};

export const USDC_ASSET_CODE = import.meta.env.VITE_USDC_ASSET_CODE ?? 'USDC';
export const USDC_ISSUER = import.meta.env.VITE_USDC_ISSUER ?? 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const USDC_ASSET = new Asset(USDC_ASSET_CODE, USDC_ISSUER);

export const ASSET_CONTRACTS: Record<string, string> = {
  XLM: import.meta.env.VITE_XLM_CONTRACT_ID || Asset.native().contractId(PASSPHRASE),
  USDC: import.meta.env.VITE_USDC_CONTRACT_ID || USDC_ASSET.contractId(PASSPHRASE),
};

export const resolveAssetContractId = (asset: string): string => {
  if (StrKey.isValidContract(asset)) return asset;

  const contractId = ASSET_CONTRACTS[asset.toUpperCase()];
  if (!contractId) {
    throw new Error(`Missing Soroban asset contract for ${asset}. Set VITE_${asset.toUpperCase()}_CONTRACT_ID or VITE_USDC_ISSUER.`);
  }
  return contractId;
};
