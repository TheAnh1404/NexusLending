import React from 'react';
import { Steps } from 'antd';
import { Loader2 } from 'lucide-react';

export type FaucetProgressStep =
  | 'idle'
  | 'validating'
  | 'request_accepted'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'failed';

interface FaucetRequestProgressProps {
  currentStep: FaucetProgressStep;
  assetCode: string;
  requiresWalletSignature?: boolean;
}

export const FaucetRequestProgress: React.FC<FaucetRequestProgressProps> = ({
  currentStep,
  assetCode,
  requiresWalletSignature = false,
}) => {
  if (currentStep === 'idle') return null;

  const getStepIndex = (step: FaucetProgressStep): number => {
    if (!requiresWalletSignature) {
      switch (step) {
        case 'validating':
          return 0;
        case 'request_accepted':
        case 'submitting':
          return 1;
        case 'confirming':
        case 'success':
        case 'failed':
          return 2;
        default:
          return 0;
      }
    }

    switch (step) {
      case 'validating':
        return 0;
      case 'request_accepted':
        return 1;
      case 'submitting':
        return 2;
      case 'confirming':
        return 3;
      case 'success':
        return 4;
      case 'failed':
        return 3;
      default:
        return 0;
    }
  };

  const current = getStepIndex(currentStep);
  const items = requiresWalletSignature
    ? [
      { title: 'Validate Wallet', description: 'Checking address' },
      { title: 'Sign Wallet', description: 'Trustline or faucet claim' },
      { title: 'Submitting', description: 'Soroban Testnet RPC' },
      { title: 'Confirming', description: 'Stellar Ledger block' },
    ]
    : [
      { title: 'Validate Wallet', description: 'Checking address' },
      { title: 'Submitting', description: 'Sending faucet request' },
      { title: 'Confirming', description: 'Stellar Testnet ledger' },
    ];

  return (
    <div
      style={{
        padding: 16,
        backgroundColor: 'var(--bg-subtle, #f8fafc)',
        borderRadius: 12,
        border: '1px solid var(--border-light, #e2e8f0)',
        marginTop: 16,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary-color)' }} />
        <span>Requesting test {assetCode}...</span>
      </div>

      <Steps
        size="small"
        current={current}
        status={currentStep === 'failed' ? 'error' : 'process'}
        items={items}
      />
    </div>
  );
};
