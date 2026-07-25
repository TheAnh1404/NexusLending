import React from 'react';
import { Button, Typography } from 'antd';
import { Wallet, CheckCircle2 } from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';

const { Text } = Typography;

interface ConnectedWalletControlProps {
  onAddressSelect: (address: string) => void;
  disabled?: boolean;
}

export const ConnectedWalletControl: React.FC<ConnectedWalletControlProps> = ({
  onAddressSelect,
  disabled = false,
}) => {
  const { isConnected, publicKey, connect, isLoading } = useWallet();

  const handleConnect = async () => {
    if (!isConnected) {
      const connection = await connect();
      onAddressSelect(connection.publicKey);
      return;
    }
    if (publicKey) {
      onAddressSelect(publicKey);
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: 'var(--bg-subtle, #f8fafc)',
        borderRadius: 12,
        border: '1px solid var(--border-light, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(79, 70, 229, 0.1)',
            color: isConnected ? 'var(--success-color, #10b981)' : 'var(--primary-color, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Wallet size={16} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {isConnected ? 'Freighter Connected' : 'Connect Wallet'}
          </div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            {isConnected ? (
              <span style={{ fontFamily: 'monospace' }}>
                {publicKey?.slice(0, 6)}...{publicKey?.slice(-6)}
              </span>
            ) : (
              'Auto-fill your active Stellar address'
            )}
          </Text>
        </div>
      </div>

      <div>
        {isConnected ? (
          <Button
            type="default"
            size="small"
            icon={<CheckCircle2 size={13} style={{ color: 'var(--success-color)' }} />}
            onClick={() => publicKey && onAddressSelect(publicKey)}
            disabled={disabled}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}
          >
            Use Address
          </Button>
        ) : (
          <Button
            type="primary"
            size="small"
            loading={isLoading}
            onClick={handleConnect}
            disabled={disabled}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
};
