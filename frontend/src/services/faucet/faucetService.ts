import { StrKey } from '@stellar/stellar-sdk';
import { apiClient } from '../api/client';
import { faucetAssets, type FaucetAsset } from './faucetConfig';
import { faucetContract } from '../soroban/faucet.contract';
import { HORIZON_URL, USDC_ASSET_CODE, isValidContractId } from '../soroban/config';
import { createUsdcTrustline, hasUsdcTrustline, type TxStage } from '../soroban/transaction';

export interface FaucetClaimResult {
  requestId: string;
  walletAddress: string;
  asset: string;
  amount: string;
  txHash: string;
  explorerUrl: string;
  updatedBalance: number;
  claimedAt: string;
  nextAvailableAt: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  message?: string;
  remainingCooldownSeconds?: number;
  nextAvailableAt?: string;
}

export const FAUCET_RECENT_REQUESTS_KEY = 'nexus_faucet_recent_requests';

const MAX_RECENT_REQUESTS = 8;

export class FaucetService {
  public validateAddress(address: string): { valid: boolean; error?: string } {
    if (!address || address.trim() === '') {
      return { valid: false, error: 'Please enter a wallet address.' };
    }

    const trimmed = address.trim();

    if (StrKey.isValidEd25519SecretSeed(trimmed) || trimmed.startsWith('S')) {
      return {
        valid: false,
        error: 'Never enter a secret key here. Only use a public Stellar wallet address beginning with G.',
      };
    }

    if (!StrKey.isValidEd25519PublicKey(trimmed)) {
      return {
        valid: false,
        error: 'Invalid wallet address. Address must be a 56-character Stellar public key starting with G.',
      };
    }

    return { valid: true };
  }

  public async getConfig(): Promise<FaucetAsset[]> {
    try {
      const response = await apiClient.get<{ assets: FaucetAsset[] }>('/api/faucet/config');
      if (response && Array.isArray(response.assets)) {
        return this.mergeAssetConfig(response.assets);
      }
    } catch {
      // Local Vite config keeps the faucet usable when the backend is offline.
    }

    return faucetAssets;
  }

  public async checkEligibility(walletAddress: string, assetCode: string): Promise<EligibilityResult> {
    const validation = this.validateAddress(walletAddress);
    if (!validation.valid) {
      return { eligible: false, message: validation.error };
    }

    const localEligibility = this.checkLocalEligibility(walletAddress, assetCode);
    if (!localEligibility.eligible) return localEligibility;

    try {
      return await apiClient.get<EligibilityResult>(
        `/api/faucet/eligibility?walletAddress=${encodeURIComponent(walletAddress.trim())}&asset=${encodeURIComponent(assetCode)}`
      );
    } catch {
      return { eligible: true };
    }
  }

  public async requestTokens(
    walletAddress: string,
    assetCode: string,
    useContractTx = false,
    assetConfig?: FaucetAsset,
    onStage?: (stage: TxStage) => void
  ): Promise<FaucetClaimResult> {
    const validation = this.validateAddress(walletAddress);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const cleanAddress = walletAddress.trim();
    const assetObj = assetConfig ?? faucetAssets.find((asset) => asset.code === assetCode) ?? faucetAssets[1];
    if (!assetObj.enabled) {
      throw new Error(`${assetObj.code} faucet is not configured for this environment.`);
    }

    if (useContractTx && assetObj.type === 'soroban_token') {
      if (!assetObj.contractId || !isValidContractId(assetObj.contractId)) {
        throw new Error(`${assetObj.code} contract ID is not configured. Set VITE_${assetObj.code}_CONTRACT_ID or VITE_USDC_ISSUER.`);
      }

      if (assetObj.code.toUpperCase() === USDC_ASSET_CODE.toUpperCase()) {
        await this.ensureUsdcTrustline(cleanAddress, onStage);
      }

      const txResult = await faucetContract.requestTokensTx(cleanAddress, assetObj.code, assetObj.contractId, onStage);
      const nextAvailableAt = new Date(Date.now() + assetObj.cooldownSeconds * 1000).toISOString();
      return {
        requestId: `contract_${txResult.txHash.slice(0, 10)}`,
        walletAddress: cleanAddress,
        asset: assetObj.code,
        amount: assetObj.claimAmount,
        txHash: txResult.txHash,
        explorerUrl: txResult.explorerUrl,
        updatedBalance: parseFloat(assetObj.claimAmount),
        claimedAt: new Date().toISOString(),
        nextAvailableAt,
      };
    }

    if (assetObj.type === 'soroban_token') {
      throw new Error(`Connect Freighter and use the connected wallet address to claim ${assetObj.code} through the Soroban faucet contract.`);
    }

    const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    onStage?.('submitting');

    try {
      const result = await apiClient.post<FaucetClaimResult>('/api/faucet/request', {
        walletAddress: cleanAddress,
        asset: assetObj.code,
        idempotencyKey,
      });
      onStage?.('confirmed');
      return result;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Faucet request failed.';

      if (assetObj.code === 'XLM' && (errMsg.includes('Cannot connect to backend') || errMsg.includes('Failed to fetch'))) {
        const result = await this.clientSideXlmFriendbotFallback(cleanAddress, assetObj);
        onStage?.('confirmed');
        return result;
      }

      throw new Error(errMsg);
    }
  }

  public getRecentRequests(): FaucetClaimResult[] {
    if (typeof localStorage === 'undefined') return [];

    try {
      const raw = localStorage.getItem(FAUCET_RECENT_REQUESTS_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as FaucetClaimResult[];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item) => item?.requestId && item.walletAddress && item.asset && item.claimedAt)
        .slice(0, MAX_RECENT_REQUESTS);
    } catch {
      return [];
    }
  }

  public saveRecentRequests(requests: FaucetClaimResult[]): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(FAUCET_RECENT_REQUESTS_KEY, JSON.stringify(requests.slice(0, MAX_RECENT_REQUESTS)));
    } catch {
      // Ignore storage failures.
    }
  }

  public addRecentRequest(result: FaucetClaimResult): FaucetClaimResult[] {
    const next = [
      result,
      ...this.getRecentRequests().filter((item) => item.requestId !== result.requestId),
    ].slice(0, MAX_RECENT_REQUESTS);
    this.saveRecentRequests(next);
    return next;
  }

  public async resetFaucetState(): Promise<void> {
    try {
      await apiClient.post('/api/faucet/reset', {});
    } catch {
      // Ignore if offline.
    }
    this.saveRecentRequests([]);
  }

  private async clientSideXlmFriendbotFallback(address: string, assetObj: FaucetAsset): Promise<FaucetClaimResult> {
    try {
      const friendbotRes = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
      if (!friendbotRes.ok) {
        const detail = await friendbotRes.text().catch(() => '');
        throw new Error(detail || `Friendbot request failed with HTTP ${friendbotRes.status}.`);
      }

      const data = (await friendbotRes.json()) as { hash?: string };
      if (!data.hash) {
        throw new Error('Friendbot did not return a transaction hash.');
      }

      const nextAvailableAt = new Date(Date.now() + assetObj.cooldownSeconds * 1000).toISOString();
      const updatedBalance = await this.fetchNativeBalance(address).catch(() => parseFloat(assetObj.claimAmount));

      return {
        requestId: `req_client_${Date.now()}`,
        walletAddress: address,
        asset: assetObj.code,
        amount: assetObj.claimAmount,
        txHash: data.hash,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${data.hash}`,
        updatedBalance,
        claimedAt: new Date().toISOString(),
        nextAvailableAt,
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Friendbot request failed.');
    }
  }

  private async ensureUsdcTrustline(address: string, onStage?: (stage: TxStage) => void): Promise<void> {
    let hasTrustline = false;

    try {
      hasTrustline = await hasUsdcTrustline(address);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('not found')) {
        throw new Error('Your Stellar account is not active yet. Claim XLM first, then request USDC.');
      }
      throw error;
    }

    if (hasTrustline) return;

    await createUsdcTrustline(address, onStage);
  }

  private mergeAssetConfig(remoteAssets: FaucetAsset[]): FaucetAsset[] {
    const localByCode = new Map(faucetAssets.map((asset) => [asset.code.toUpperCase(), asset]));
    const remoteCodes = new Set<string>();

    const merged = remoteAssets.map((remoteAsset) => {
      const localAsset = localByCode.get(remoteAsset.code.toUpperCase());
      remoteCodes.add(remoteAsset.code.toUpperCase());

      if (!localAsset) return remoteAsset;

      const remoteHasBackendFunding = remoteAsset.enabled && remoteAsset.type === 'custom_asset';
      return {
        ...localAsset,
        ...remoteAsset,
        type: remoteHasBackendFunding ? remoteAsset.type : localAsset.type,
        contractId: remoteAsset.contractId || localAsset.contractId,
        enabled: Boolean(remoteAsset.enabled || localAsset.enabled),
      };
    });

    const localOnly = faucetAssets.filter((asset) => !remoteCodes.has(asset.code.toUpperCase()));
    return [...merged, ...localOnly];
  }

  private checkLocalEligibility(walletAddress: string, assetCode: string): EligibilityResult {
    const assetObj = faucetAssets.find((asset) => asset.code.toUpperCase() === assetCode.toUpperCase());
    if (!assetObj) return { eligible: true };

    const matchingClaim = this.getRecentRequests().find((claim) =>
      claim.walletAddress === walletAddress.trim() && claim.asset.toUpperCase() === assetObj.code.toUpperCase()
    );
    if (!matchingClaim) return { eligible: true };

    const nextAvailableAt = new Date(matchingClaim.nextAvailableAt).getTime();
    if (!Number.isFinite(nextAvailableAt)) return { eligible: true };

    const remainingCooldownSeconds = Math.max(0, Math.ceil((nextAvailableAt - Date.now()) / 1000));
    if (remainingCooldownSeconds <= 0) return { eligible: true };

    return {
      eligible: false,
      reason: 'LOCAL_COOLDOWN_ACTIVE',
      message: `Cooldown active. You can request ${assetObj.code} again later.`,
      remainingCooldownSeconds,
      nextAvailableAt: matchingClaim.nextAvailableAt,
    };
  }

  private async fetchNativeBalance(address: string): Promise<number> {
    const horizonUrl = HORIZON_URL.replace(/\/$/, '');
    const response = await fetch(`${horizonUrl}/accounts/${address}`);
    if (!response.ok) return 0;

    const data = await response.json() as {
      balances?: Array<{ asset_type?: string; balance?: string }>;
    };
    const nativeBalance = data.balances?.find((balance) => balance.asset_type === 'native');
    const parsed = Number(nativeBalance?.balance);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

export const faucetService = new FaucetService();
