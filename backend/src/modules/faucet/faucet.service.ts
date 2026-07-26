import { Address, Asset, Contract, Horizon, Keypair, Memo, Networks, Operation, StrKey, TransactionBuilder, nativeToScVal, rpc } from '@stellar/stellar-sdk';
import { faucetAssetAllowlist, type FaucetAssetConfig } from './faucet.config.js';

const HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';
const horizonServer = new Horizon.Server(HORIZON_TESTNET_URL);
const rpcServer = new rpc.Server(process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443');

export interface FaucetClaimRequest {
  walletAddress: string;
  asset: string;
  idempotencyKey?: string;
}

export interface FaucetClaimResponse {
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

interface RequestRecord {
  lastClaimedAt: number; // Unix timestamp in ms
  countToday: number;
  dateStr: string;
}

type LoadedAccount = Awaited<ReturnType<typeof horizonServer.loadAccount>>;

// In-memory request ledger for cooldown and rate limiting
const requestLogMap = new Map<string, RequestRecord>();
const processedIdempotencyKeys = new Set<string>();

export class FaucetService {
  /**
   * Reset all in-memory faucet rate-limit records & cooldown logs
   */
  public resetLedger(): void {
    requestLogMap.clear();
    processedIdempotencyKeys.clear();
  }

  /**
   * Get supported faucet assets and rules configuration
   */
  public getConfig() {
    return {
      network: 'testnet',
      networkPassphrase: Networks.TESTNET,
      assets: faucetAssetAllowlist,
    };
  }

  /**
   * Validate Stellar wallet address format and safety
   */
  public validateWalletAddress(address: string): void {
    if (!address || typeof address !== 'string') {
      throw new Error('Wallet address is required.');
    }

    const trimmed = address.trim();

    if (StrKey.isValidEd25519SecretSeed(trimmed) || trimmed.startsWith('S')) {
      throw new Error('Never enter a secret key here. Only use a public Stellar wallet address beginning with G.');
    }

    if (!StrKey.isValidEd25519PublicKey(trimmed)) {
      throw new Error('Invalid wallet address format. Must be a valid Stellar public key beginning with G.');
    }
  }

  /**
   * Check eligibility for a specific wallet & asset
   */
  public checkEligibility(walletAddress: string, assetCode: string) {
    this.validateWalletAddress(walletAddress);

    const assetConfig = faucetAssetAllowlist.find(
      (a) => a.code.toUpperCase() === assetCode.toUpperCase() && a.enabled
    );

    if (!assetConfig) {
      throw new Error(`Asset '${assetCode}' is not supported or currently disabled.`);
    }

    const key = `${walletAddress.trim()}_${assetConfig.code}`;
    const now = Date.now();
    const record = requestLogMap.get(key);

    if (record) {
      const todayStr = new Date(now).toISOString().split('T')[0];
      if (record.dateStr === todayStr && record.countToday >= assetConfig.dailyLimit) {
        const nextAvailableAt = this.nextUtcDayIso(now);
        return {
          eligible: false,
          reason: 'DAILY_LIMIT_REACHED',
          message: `Daily request limit reached for ${assetConfig.code}. Try again tomorrow.`,
          remainingCooldownSeconds: Math.ceil((new Date(nextAvailableAt).getTime() - now) / 1000),
          nextAvailableAt,
        };
      }

      const cooldownMs = assetConfig.cooldownSeconds * 1000;
      const elapsed = now - record.lastClaimedAt;

      if (elapsed < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
        const nextAvailableAt = new Date(now + remainingSeconds * 1000).toISOString();
        return {
          eligible: false,
          reason: 'COOLDOWN_ACTIVE',
          message: `Cooldown active. You can request ${assetConfig.code} again in ${this.formatRemainingTime(remainingSeconds)}.`,
          remainingCooldownSeconds: remainingSeconds,
          nextAvailableAt,
        };
      }
    }

    return {
      eligible: true,
      asset: assetConfig,
      claimAmount: assetConfig.claimAmount,
      cooldownSeconds: assetConfig.cooldownSeconds,
    };
  }

  /**
   * Request test tokens for a wallet address
   */
  public async requestTokens(payload: FaucetClaimRequest): Promise<FaucetClaimResponse> {
    const { walletAddress, asset: requestedAsset, idempotencyKey } = payload;

    // Address validation
    this.validateWalletAddress(walletAddress);
    const cleanAddress = walletAddress.trim();

    // Idempotency check
    if (idempotencyKey) {
      if (processedIdempotencyKeys.has(idempotencyKey)) {
        throw new Error('Duplicate request detected. Please wait before submitting again.');
      }
      processedIdempotencyKeys.add(idempotencyKey);
    }

    // Asset validation
    const assetConfig = faucetAssetAllowlist.find(
      (a) => a.code.toUpperCase() === requestedAsset.toUpperCase() && a.enabled
    );

    if (!assetConfig) {
      throw new Error(`Asset '${requestedAsset}' is not supported on Stellar Testnet Faucet.`);
    }

    // Rate limit check
    const key = `${cleanAddress}_${assetConfig.code}`;
    const now = Date.now();
    const record = requestLogMap.get(key);

    if (record) {
      const todayStr = new Date(now).toISOString().split('T')[0];
      if (record.dateStr === todayStr && record.countToday >= assetConfig.dailyLimit) {
        throw new Error(`Daily request limit reached for ${assetConfig.code}. Try again tomorrow.`);
      }

      const cooldownMs = assetConfig.cooldownSeconds * 1000;
      const elapsed = now - record.lastClaimedAt;

      if (elapsed < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
        throw new Error(
          `Request limit reached. You can request ${assetConfig.code} again in ${this.formatRemainingTime(remainingSeconds)}.`
        );
      }
    }

    let txHash = '';
    let updatedBalance = 1000;

    // Execute token funding with real on-chain Stellar transaction
    if (assetConfig.code === 'XLM') {
      const result = await this.fundXlmFriendbot(cleanAddress);
      txHash = result.txHash;
      updatedBalance = result.balance;
    } else if (assetConfig.type === 'soroban_token' || assetConfig.contractId) {
      const result = await this.fundSorobanToken(cleanAddress, assetConfig);
      txHash = result.txHash;
      updatedBalance = result.balance;
    } else {
      const result = await this.fundClassicAsset(cleanAddress, assetConfig);
      txHash = result.txHash;
      updatedBalance = result.balance;
    }

    const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;

    // Update request log ledger
    const todayStr = new Date().toISOString().split('T')[0];
    const newCount = record && record.dateStr === todayStr ? record.countToday + 1 : 1;

    requestLogMap.set(key, {
      lastClaimedAt: now,
      countToday: newCount,
      dateStr: todayStr,
    });

    const nextAvailableAt = new Date(now + assetConfig.cooldownSeconds * 1000).toISOString();

    return {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      walletAddress: cleanAddress,
      asset: assetConfig.code,
      amount: assetConfig.claimAmount,
      txHash,
      explorerUrl,
      updatedBalance,
      claimedAt: new Date().toISOString(),
      nextAvailableAt,
    };
  }

  /**
   * Fund Stellar native XLM using Friendbot API or On-Chain Payment
   */
  private async fundXlmFriendbot(address: string): Promise<{ txHash: string; balance: number }> {
    let accountExists = false;
    let existingBalance = 0;

    try {
      const acc = await horizonServer.loadAccount(address);
      accountExists = true;
      const nativeBal = acc.balances.find((b) => b.asset_type === 'native');
      if (nativeBal) {
        existingBalance = parseFloat(nativeBal.balance);
      }
    } catch {
      accountExists = false;
    }

    if (!accountExists) {
      try {
        const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
        if (response.ok) {
          const data = (await response.json()) as { hash?: string };
          if (data.hash) {
            return {
              txHash: data.hash,
              balance: 10000,
            };
          }
        }
      } catch {
        // Friendbot error fallback
      }
    }

    return this.submitRealOnChainPayment(address, '100', 'XLM', existingBalance);
  }

  /**
   * Fund Soroban token directly on-chain via Soroban RPC SAC mint or transfer invocation.
   */
  private async fundSorobanToken(
    address: string,
    assetConfig: FaucetAssetConfig
  ): Promise<{ txHash: string; balance: number }> {
    const claimNum = parseFloat(assetConfig.claimAmount) || 1000;
    const cleanAddress = address.trim();

    // Ensure recipient account is activated on Testnet first
    let recipientAccount: LoadedAccount | null = null;
    try {
      recipientAccount = await horizonServer.loadAccount(cleanAddress);
    } catch {
      recipientAccount = null;
    }

    if (!recipientAccount) {
      try {
        await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(cleanAddress)}`);
        recipientAccount = await horizonServer.loadAccount(cleanAddress);
      } catch {
        recipientAccount = null;
      }
    }

    if (!recipientAccount) {
      throw new Error(`Recipient account ${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-6)} could not be activated on Stellar Testnet.`);
    }

    // Check trustline requirement for Soroban SAC token (SAC mint requires recipient trustline)
    if (assetConfig.issuer) {
      const usdcAsset = new Asset(assetConfig.code, assetConfig.issuer);
      const hasTrustline = this.getAssetBalance(recipientAccount, usdcAsset) !== null;
      if (!hasTrustline) {
        throw new Error(
          `Recipient account (${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-6)}) does not have a ${assetConfig.code} trustline. Please create a ${assetConfig.code} trustline in Freighter before requesting ${assetConfig.code}.`
        );
      }
    }

    let distributorKey: Keypair;
    const secretKey = (process.env.STELLAR_FAUCET_SECRET ?? '').trim();
    if (secretKey && StrKey.isValidEd25519SecretSeed(secretKey)) {
      distributorKey = Keypair.fromSecret(secretKey);
    } else {
      distributorKey = Keypair.random();
      try {
        const fRes = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(distributorKey.publicKey())}`);
        if (fRes.ok) await fRes.json();
      } catch {
        // Ignore
      }
    }

    const contractId = (assetConfig.contractId ?? '').trim();
    if (!contractId || !StrKey.isValidContract(contractId)) {
      if (assetConfig.issuer && StrKey.isValidEd25519PublicKey(assetConfig.issuer.trim())) {
        return this.fundClassicAsset(cleanAddress, assetConfig);
      }
      throw new Error(`Contract ID is invalid or not configured for ${assetConfig.code}.`);
    }

    const isAuthorizedMinter = assetConfig.issuer ? distributorKey.publicKey() === assetConfig.issuer : true;

    try {
      const account = await horizonServer.loadAccount(distributorKey.publicKey());
      const contract = new Contract(contractId);
      const amountStroops = BigInt(Math.floor(claimNum * 10_000_000));

      const functionName = isAuthorizedMinter ? 'mint' : 'transfer';
      const args = isAuthorizedMinter
        ? [Address.fromString(cleanAddress).toScVal(), nativeToScVal(amountStroops, { type: 'i128' })]
        : [
            Address.fromString(distributorKey.publicKey()).toScVal(),
            Address.fromString(cleanAddress).toScVal(),
            nativeToScVal(amountStroops, { type: 'i128' }),
          ];

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(contract.call(functionName, ...args))
        .setTimeout(30)
        .build();

      const simResult = await rpcServer.simulateTransaction(tx);
      this.logSimulationDetails(simResult, `${assetConfig.code} ${functionName} for ${cleanAddress}`);

      if (rpc.Api.isSimulationSuccess(simResult)) {
        const assembledTx = rpc.assembleTransaction(tx, simResult).build();
        assembledTx.sign(distributorKey);
        const sendResult = await rpcServer.sendTransaction(assembledTx);
        if (sendResult.hash) {
          return {
            txHash: sendResult.hash,
            balance: claimNum,
          };
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Faucet Soroban ${assetConfig.code} Error]:`, msg.replace(/S[A-Z0-9]{55}/g, 'S***'));
    }

    if (assetConfig.issuer) {
      return this.fundClassicAsset(cleanAddress, assetConfig);
    }

    throw new Error(`Failed to disburse Soroban token ${assetConfig.code} on-chain.`);
  }

  /**
   * Fund Stellar classic assets via the backend distribution account.
   */
  private async fundClassicAsset(
    address: string,
    assetConfig: FaucetAssetConfig
  ): Promise<{ txHash: string; balance: number }> {
    const claimNum = parseFloat(assetConfig.claimAmount) || 1000;
    const cleanAddress = address.trim();
    if (!assetConfig.issuer) {
      throw new Error(`${assetConfig.code} issuer is not configured for backend faucet payments.`);
    }

    // Ensure recipient account is activated on Testnet first
    let account: LoadedAccount | null = null;
    try {
      account = await horizonServer.loadAccount(cleanAddress);
    } catch {
      account = null;
    }

    if (!account) {
      try {
        await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(cleanAddress)}`);
        account = await horizonServer.loadAccount(cleanAddress);
      } catch {
        // Ignore error
      }
    }

    if (!account) {
      throw new Error(`Recipient account ${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-6)} could not be activated on Stellar Testnet.`);
    }

    const asset = new Asset(assetConfig.code, assetConfig.issuer);
    const existingBalance = this.getAssetBalance(account, asset);
    if (existingBalance === null) {
      throw new Error(
        `Recipient account (${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-6)}) does not have a ${assetConfig.code} trustline. Please create a ${assetConfig.code} trustline in Freighter before requesting ${assetConfig.code}.`
      );
    }

    return this.submitRealOnChainPayment(cleanAddress, claimNum.toString(), assetConfig.code, existingBalance, asset);
  }

  /**
   * Submit real, signed transaction on Stellar Testnet Horizon RPC
   */
  private async submitRealOnChainPayment(
    recipientAddress: string,
    amountStr: string,
    memoText?: string,
    existingBalance: number = 0,
    asset: Asset = Asset.native()
  ): Promise<{ txHash: string; balance: number }> {
    try {
      let distributorKey: Keypair;
      const secretKey = (process.env.STELLAR_FAUCET_SECRET ?? '').trim();
      if (secretKey && StrKey.isValidEd25519SecretSeed(secretKey)) {
        distributorKey = Keypair.fromSecret(secretKey);
      } else {
        distributorKey = Keypair.random();
        try {
          const fRes = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(distributorKey.publicKey())}`);
          if (fRes.ok) {
            await fRes.json();
          }
        } catch {
          // Friendbot network fallback
        }
      }

      // Load distributor account from Horizon Testnet
      const account = await horizonServer.loadAccount(distributorKey.publicKey());

      const txBuilder = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: recipientAddress,
            asset,
            amount: amountStr,
          })
        )
        .setTimeout(30);

      if (memoText) {
        txBuilder.addMemo(Memo.text(`NEXUS FAUCET ${memoText}`.slice(0, 28)));
      }

      const transaction = txBuilder.build();
      transaction.sign(distributorKey);

      const response = await horizonServer.submitTransaction(transaction);
      const newBal = existingBalance + parseFloat(amountStr);

      return {
        txHash: response.hash,
        balance: newBal > 0 ? newBal : parseFloat(amountStr) + 1000,
      };
    } catch (err: any) {
      const resultCodes = err?.response?.data?.extras?.result_codes;
      const opCodes: string[] = Array.isArray(resultCodes?.operations) ? resultCodes.operations : [];

      if (opCodes.includes('op_no_trust') || opCodes.includes('op_src_no_trust')) {
        const issuerAddr = asset.isNative() ? '' : (asset.getIssuer() || '');
        const issuerShort = issuerAddr ? ` (Issuer: ${issuerAddr.slice(0, 6)}...)` : '';
        throw new Error(
          `Recipient account (${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-6)}) does not have a valid trustline for ${asset.getCode()}${issuerShort}. Please add/re-add the ${asset.getCode()} trustline in Freighter.`
        );
      }

      const horizonDetail = err?.response?.data?.detail ?? err?.response?.data?.title ?? (err instanceof Error ? err.message : String(err));
      const detailedMsg = resultCodes ? `${horizonDetail} (Codes: ${JSON.stringify(resultCodes)})` : horizonDetail;

      const safeMsg = detailedMsg.replace(/S[A-Z0-9]{55}/g, 'S***');

      if (!asset.isNative()) {
        throw new Error(`Failed to submit ${asset.getCode()} faucet payment: ${safeMsg}`);
      }

      throw new Error(`Failed to submit on-chain transaction to Stellar Testnet: ${safeMsg}`);
    }
  }

  private logSimulationDetails(simResult: rpc.Api.SimulateTransactionResponse, context: string): void {
    if (rpc.Api.isSimulationError(simResult)) {
      console.error(`[Soroban Simulation Error - ${context}]:`, {
        error: simResult.error,
        events: simResult.events,
        diagnosticEvents: (simResult as any).diagnosticEvents,
      });
    } else {
      console.log(`[Soroban Simulation Success - ${context}]`);
    }
  }

  private getAssetBalance(account: LoadedAccount, asset: Asset): number | null {
    const balance = account.balances.find((item) => {
      if (asset.isNative()) return item.asset_type === 'native';
      return item.asset_type !== 'native'
        && 'asset_code' in item
        && 'asset_issuer' in item
        && item.asset_code === asset.getCode()
        && item.asset_issuer === asset.getIssuer();
    });

    if (!balance) return null;

    const parsed = Number(balance.balance);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private nextUtcDayIso(now: number): string {
    const date = new Date(now);
    const nextDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
    return new Date(nextDay).toISOString();
  }

  private formatRemainingTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

export const faucetService = new FaucetService();
