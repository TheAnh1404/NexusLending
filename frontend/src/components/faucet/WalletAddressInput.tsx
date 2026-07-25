import React from 'react';
import { Input, Button, Typography, Alert } from 'antd';
import { Wallet, Clipboard, X, CheckCircle } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';
import { faucetService } from '../../services/faucet/faucetService';

const { Text } = Typography;

interface WalletAddressInputProps {
  value: string;
  onChange: (val: string) => void;
  error: string | null;
  setError: (err: string | null) => void;
  disabled?: boolean;
}

export const WalletAddressInput: React.FC<WalletAddressInputProps> = ({
  value,
  onChange,
  error,
  setError,
  disabled = false,
}) => {
  const { isConnected, publicKey } = useWallet();

  const handleTextChange = (rawText: string) => {
    const trimmed = rawText.trim();

    // Secret key safety detection: if user enters an S... secret key
    if (trimmed.startsWith('S') || trimmed.length > 50 && trimmed.startsWith('S')) {
      setError('Never enter a secret key here. Only use a public Stellar wallet address beginning with G.');
      onChange(''); // Immediately clear the input value!
      return;
    }

    onChange(trimmed);

    if (trimmed === '') {
      setError(null);
      return;
    }

    const validation = faucetService.validateAddress(trimmed);
    if (!validation.valid) {
      setError(validation.error || 'Invalid Stellar wallet address.');
    } else {
      setError(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleTextChange(text);
    } catch {
      // Ignore clipboard read error
    }
  };

  const handleUseConnected = () => {
    if (isConnected && publicKey) {
      handleTextChange(publicKey);
    }
  };

  const handleClear = () => {
    onChange('');
    setError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text strong style={{ fontSize: 13 }}>
          Stellar Wallet Address
        </Text>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isConnected && publicKey && (
            <Button
              type="link"
              size="small"
              onClick={handleUseConnected}
              style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600 }}
            >
              Use Connected Wallet
            </Button>
          )}
          {value && (
            <Button
              type="text"
              size="small"
              icon={<X size={12} />}
              onClick={handleClear}
              disabled={disabled}
              style={{ fontSize: 11, color: 'var(--text-muted)' }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Input
        size="large"
        placeholder="G..."
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        disabled={disabled}
        status={error ? 'error' : ''}
        prefix={<Wallet size={16} style={{ color: 'var(--text-muted)' }} />}
        suffix={
          <Button
            type="text"
            size="small"
            icon={<Clipboard size={14} />}
            onClick={handlePaste}
            disabled={disabled}
            style={{ color: 'var(--text-muted)' }}
          >
            Paste
          </Button>
        }
        style={{ borderRadius: 10, fontFamily: 'monospace', fontSize: 13 }}
      />

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ borderRadius: 8, padding: '6px 12px', fontSize: 12 }}
        />
      )}

      {value && !error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--success-color)' }}>
          <CheckCircle size={13} />
          <span>Valid Stellar Public Key</span>
        </div>
      )}
    </div>
  );
};
