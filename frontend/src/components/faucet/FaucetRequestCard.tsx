import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from 'antd';
import { WalletAddressInput } from './WalletAddressInput';
import { ConnectedWalletControl } from './ConnectedWalletControl';
import { FaucetAssetSelector } from './FaucetAssetSelector';
import { FaucetUsageLimit } from './FaucetUsageLimit';
import { FaucetRequestButton } from './FaucetRequestButton';
import { FaucetRequestProgress, type FaucetProgressStep } from './FaucetRequestProgress';
import { FaucetSuccessResult } from './FaucetSuccessResult';
import { FaucetErrorResult } from './FaucetErrorResult';
import { FaucetRecentRequests } from './FaucetRecentRequests';

import { faucetService, type FaucetClaimResult } from '../../services/faucet/faucetService';
import { faucetAssets, type FaucetAsset } from '../../services/faucet/faucetConfig';
import { faucetContract } from '../../services/soroban/faucet.contract';
import { useWallet } from '../../hooks/useWallet';
import { useAppContext } from '../../app/AppContext';

export const FaucetRequestCard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { isConnected, publicKey } = useWallet();
  const { refreshData } = useAppContext();

  // Query parameter pre-selections
  const queryAsset = searchParams.get('asset')?.toUpperCase();
  const defaultAsset = faucetAssets.find((a) => a.code === queryAsset)?.code || 'USDC';

  const [assets, setAssets] = useState<FaucetAsset[]>(faucetAssets);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [selectedAssetCode, setSelectedAssetCode] = useState<string>(defaultAsset);
  const [addressError, setAddressError] = useState<string | null>(null);

  const [progressStep, setProgressStep] = useState<FaucetProgressStep>('idle');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [claimResult, setClaimResult] = useState<FaucetClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [technicalDetails, setTechnicalDetails] = useState<{ rawError?: string; requestId?: string } | undefined>(undefined);

  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [recentRequests, setRecentRequests] = useState<FaucetClaimResult[]>([]);

  useEffect(() => {
    setRecentRequests(faucetService.getRecentRequests());
  }, []);

  useEffect(() => {
    let cancelled = false;

    void faucetService.getConfig().then((nextAssets) => {
      if (cancelled || nextAssets.length === 0) return;

      setAssets(nextAssets);
      setSelectedAssetCode((current) => {
        const currentAsset = nextAssets.find((asset) => asset.code === current);
        if (currentAsset?.enabled) return current;
        return nextAssets.find((asset) => asset.enabled)?.code ?? nextAssets[0].code;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto fill connected wallet address if available and field is empty
  useEffect(() => {
    if (isConnected && publicKey && !walletAddress) {
      setWalletAddress(publicKey);
    }
  }, [isConnected, publicKey, walletAddress]);

  // Active selected asset config
  const activeAsset: FaucetAsset = useMemo(
    () => assets.find((a) => a.code === selectedAssetCode) || assets.find((a) => a.enabled) || assets[0] || faucetAssets[0],
    [assets, selectedAssetCode]
  );

  const isConnectedWallet = Boolean(isConnected && publicKey && publicKey === walletAddress.trim());
  const blockedReason = useMemo(() => {
    if (!activeAsset.enabled) return `${activeAsset.code} Not Configured`;
    if (activeAsset.type === 'soroban_token' && !faucetContract.isConfigured()) return 'Faucet Contract Missing';
    if (activeAsset.type === 'soroban_token' && !isConnectedWallet) return 'Use Connected Wallet';
    return null;
  }, [activeAsset, isConnectedWallet]);

  useEffect(() => {
    const validation = faucetService.validateAddress(walletAddress);
    if (!walletAddress || !validation.valid) {
      setCooldownRemaining(0);
      return;
    }

    let cancelled = false;
    void faucetService.checkEligibility(walletAddress, selectedAssetCode).then((eligibility) => {
      if (cancelled) return;
      setCooldownRemaining(eligibility.remainingCooldownSeconds ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedAssetCode, walletAddress]);

  useEffect(() => {
    if (cooldownRemaining <= 0) return undefined;

    const intervalId = window.setInterval(() => {
      setCooldownRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [cooldownRemaining]);

  // Handle asset request execution
  const handleRequest = async () => {
    setClaimError(null);
    setClaimResult(null);
    setTechnicalDetails(undefined);

    const validation = faucetService.validateAddress(walletAddress);
    if (!validation.valid) {
      setAddressError(validation.error || 'Invalid address');
      return;
    }

    setIsLoading(true);
    setProgressStep('validating');

    try {
      const result = await faucetService.requestTokens(
        walletAddress,
        selectedAssetCode,
        activeAsset.type === 'soroban_token' && isConnectedWallet,
        activeAsset,
        (stage) => {
          if (stage === 'preparing') setProgressStep('validating');
          else if (stage === 'wallet') setProgressStep('request_accepted');
          else if (stage === 'submitting') setProgressStep('submitting');
          else if (stage === 'confirming') setProgressStep('confirming');
        }
      );

      setProgressStep('success');
      setClaimResult(result);
      setRecentRequests(faucetService.addRecentRequest(result));
      const nextAvailableAt = new Date(result.nextAvailableAt).getTime();
      const remaining = Math.max(0, Math.ceil((nextAvailableAt - Date.now()) / 1000));
      setCooldownRemaining(remaining || activeAsset.cooldownSeconds);
      if (isConnectedWallet) {
        void refreshData();
      }
    } catch (err: unknown) {
      setProgressStep('failed');
      const msg = err instanceof Error ? err.message : 'Failed to request test tokens.';
      setClaimError(msg);
      setTechnicalDetails({
        rawError: String(err),
        requestId: `req_err_${Date.now()}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setClaimResult(null);
    setClaimError(null);
    setProgressStep('idle');
  };

  return (
    <div className="faucet-card-wrap" style={{ width: '100%', maxWidth: 560, minWidth: 0, margin: '0 auto', boxSizing: 'border-box' }}>
      <Card
        className="card-premium faucet-card"
        styles={{ body: { padding: 28 } }}
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          borderRadius: 20,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid var(--border-light, #e2e8f0)',
        }}
      >
        {/* Connected Wallet Control shortcut */}
        <ConnectedWalletControl
          onAddressSelect={(addr) => {
            setWalletAddress(addr);
            setAddressError(null);
          }}
          disabled={isLoading}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Wallet Address Input */}
          <WalletAddressInput
            value={walletAddress}
            onChange={(val) => {
              setWalletAddress(val);
              handleReset();
            }}
            error={addressError}
            setError={setAddressError}
            disabled={isLoading}
          />

          {/* Faucet Asset Selector */}
          <FaucetAssetSelector
            assets={assets}
            selectedCode={selectedAssetCode}
            onSelect={(code) => {
              setSelectedAssetCode(code);
              handleReset();
            }}
            disabled={isLoading}
          />

          {/* Usage Limit info */}
          <FaucetUsageLimit
            asset={activeAsset}
            cooldownSecondsRemaining={cooldownRemaining}
          />

          {/* Main Action Button */}
          {!claimResult && !claimError && (
            <FaucetRequestButton
              walletAddress={walletAddress}
              assetCode={selectedAssetCode}
              loading={isLoading}
              cooldownActive={cooldownRemaining > 0}
              hasError={Boolean(addressError)}
              blockedReason={blockedReason}
              onRequest={handleRequest}
            />
          )}

          {/* Progress Indicator */}
          {isLoading && (
            <FaucetRequestProgress
              currentStep={progressStep}
              assetCode={selectedAssetCode}
              requiresWalletSignature={activeAsset.type === 'soroban_token'}
            />
          )}

          {/* Success State */}
          {claimResult && !isLoading && (
            <FaucetSuccessResult result={claimResult} onReset={handleReset} />
          )}

          {/* Error State */}
          {claimError && !isLoading && (
            <FaucetErrorResult
              errorMessage={claimError}
              technicalDetails={technicalDetails}
              onRetry={handleRequest}
            />
          )}
        </div>
      </Card>

      {/* Session Recent Requests */}
      <FaucetRecentRequests requests={recentRequests} />
    </div>
  );
};
