import React from 'react';
import { Segmented, Typography, Card, Tag } from 'antd';
import { type FaucetAsset } from '../../services/faucet/faucetConfig';
import { Coins, DollarSign, Shield } from 'lucide-react';

const { Text } = Typography;

interface FaucetAssetSelectorProps {
  assets: FaucetAsset[];
  selectedCode: string;
  onSelect: (code: string) => void;
  disabled?: boolean;
}

export const FaucetAssetSelector: React.FC<FaucetAssetSelectorProps> = ({
  assets,
  selectedCode,
  onSelect,
  disabled = false,
}) => {
  const selectedAsset = assets.find((a) => a.code === selectedCode) || assets[0];

  const getAssetIcon = (code: string) => {
    if (code === 'XLM') return <Coins size={16} style={{ color: '#14b8a6' }} />;
    if (code === 'USDC') return <DollarSign size={16} style={{ color: '#2775ca' }} />;
    return <Shield size={16} style={{ color: '#f59e0b' }} />;
  };

  const getSegmentLabel = (code: string) => code === 'COLLATERAL' ? 'COL' : code;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <Text strong style={{ fontSize: 13 }}>
        Select Asset
      </Text>

      <Segmented
        className="faucet-asset-segmented"
        block
        disabled={disabled}
        value={selectedCode}
        onChange={(val) => onSelect(val as string)}
        style={{ width: '100%', minWidth: 0 }}
        options={assets.map((asset) => ({
          value: asset.code,
          disabled: !asset.enabled,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 0', minWidth: 0 }}>
              {getAssetIcon(asset.code)}
              <span style={{ fontWeight: 700, fontSize: 12 }}>{getSegmentLabel(asset.code)}</span>
            </div>
          ),
        }))}
      />

      {/* Asset details card */}
      {selectedAsset && (
        <Card
          styles={{ body: { padding: 12 } }}
          style={{
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            borderRadius: 10,
            border: '1px solid var(--border-light, #e2e8f0)',
            width: '100%',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 13 }}>{selectedAsset.displayName}</Text>
            {selectedAsset.enabled ? (
              <Text strong style={{ fontSize: 13, color: 'var(--primary-color)' }}>
                {selectedAsset.claimAmount} {selectedAsset.code}
              </Text>
            ) : (
              <Tag color="warning" style={{ margin: 0 }}>Not Configured</Tag>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {selectedAsset.enabled
              ? selectedAsset.usage
              : `Set ${selectedAsset.code === 'USDC' ? 'VITE_USDC_ISSUER or VITE_USDC_CONTRACT_ID' : `VITE_${selectedAsset.code}_CONTRACT_ID`} to enable this asset.`}
          </div>
        </Card>
      )}
    </div>
  );
};
