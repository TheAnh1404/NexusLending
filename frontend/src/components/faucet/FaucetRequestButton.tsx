import React from 'react';
import { Button } from 'antd';
import { Send, Loader2 } from 'lucide-react';

interface FaucetRequestButtonProps {
  walletAddress: string;
  assetCode: string;
  loading: boolean;
  cooldownActive: boolean;
  hasError: boolean;
  blockedReason?: string | null;
  onRequest: () => void;
}

export const FaucetRequestButton: React.FC<FaucetRequestButtonProps> = ({
  walletAddress,
  assetCode,
  loading,
  cooldownActive,
  hasError,
  blockedReason,
  onRequest,
}) => {
  const getButtonState = () => {
    if (loading) {
      return { text: 'Requesting Test Tokens...', disabled: true };
    }
    if (cooldownActive) {
      return { text: 'Available Again Later', disabled: true };
    }
    if (!walletAddress || walletAddress.trim() === '') {
      return { text: 'Enter Wallet Address', disabled: true };
    }
    if (hasError) {
      return { text: 'Fix Address Error to Request', disabled: true };
    }
    if (blockedReason) {
      return { text: blockedReason, disabled: true };
    }
    return { text: `Request Test ${assetCode}`, disabled: false };
  };

  const { text, disabled } = getButtonState();

  return (
    <Button
      className="faucet-action-button"
      type="primary"
      size="large"
      block
      disabled={disabled}
      loading={loading}
      onClick={onRequest}
      icon={loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
      style={{
        height: 48,
        borderRadius: 12,
        fontWeight: 700,
        fontSize: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minWidth: 0,
        boxShadow: disabled ? 'none' : '0 4px 14px rgba(79, 70, 229, 0.3)',
      }}
    >
      {text}
    </Button>
  );
};
