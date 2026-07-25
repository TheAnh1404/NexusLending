import React from 'react';
import { Typography } from 'antd';
import { Clock } from 'lucide-react';
import { type FaucetAsset } from '../../services/faucet/faucetConfig';

const { Text } = Typography;

interface FaucetUsageLimitProps {
  asset: FaucetAsset;
  cooldownSecondsRemaining?: number;
}

export const FaucetUsageLimit: React.FC<FaucetUsageLimitProps> = ({
  asset,
  cooldownSecondsRemaining = 0,
}) => {
  const cooldownHours = Math.round((asset.cooldownSeconds / 3600) * 10) / 10;

  const formatTimer = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${remainingSecs
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        padding: '10px 14px',
        backgroundColor: cooldownSecondsRemaining > 0 ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-subtle, #f8fafc)',
        borderRadius: 10,
        border:
          cooldownSecondsRemaining > 0
            ? '1px solid rgba(245, 158, 11, 0.3)'
            : '1px solid var(--border-light, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 12,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Clock
        size={15}
        style={{ color: cooldownSecondsRemaining > 0 ? '#f59e0b' : 'var(--text-muted)' }}
      />
      <div style={{ minWidth: 0 }}>
        {cooldownSecondsRemaining > 0 ? (
          <Text strong style={{ color: '#d97706' }}>
            You can request {asset.code} again in {formatTimer(cooldownSecondsRemaining)}.
          </Text>
        ) : (
          <Text type="secondary">
            Up to {asset.dailyLimit} request{asset.dailyLimit === 1 ? '' : 's'} per day for {asset.code}. Cooldown: {cooldownHours}h. Claim: {asset.claimAmount} {asset.code}.
          </Text>
        )}
      </div>
    </div>
  );
};
