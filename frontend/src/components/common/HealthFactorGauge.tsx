import React from 'react';
import { Progress, Typography } from 'antd';
import { getRiskZone } from '../../utils/finance';

const { Text } = Typography;

interface HealthFactorGaugeProps {
  value: number;
  size?: number;
  showMeaning?: boolean;
}

export const HealthFactorGauge: React.FC<HealthFactorGaugeProps> = ({
  value,
  size = 120,
  showMeaning = false,
}) => {
  const isInfinite = value >= 99.0;
  const riskZone = getRiskZone(value);

  let color = '#27AE60';
  let meaning = 'Healthy';

  if (riskZone === 'WARNING') {
    color = '#F2994A';
    meaning = 'Needs attention';
  } else if (riskZone === 'LIQUIDATION_PLANNING') {
    color = '#EB5757';
    meaning = 'Liquidatable';
  }

  const progressPercent = isInfinite
    ? 100
    : Math.min(100, Math.max(0, (value / 3.0) * 100));

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <Progress
        type="dashboard"
        percent={progressPercent}
        strokeColor={color}
        strokeWidth={8}
        width={size}
        format={() => (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span
              style={{
                fontSize: size > 100 ? '22px' : '16px',
                fontWeight: 700,
                fontFamily: 'var(--font-heading)',
                color: 'var(--text-main)',
              }}
            >
              {isInfinite ? 'N/A' : value.toFixed(2)}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              HF
            </span>
          </div>
        )}
      />
      <Text
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {isInfinite ? 'NO DEBT' : riskZone.replace('_', ' ')}
      </Text>
      {showMeaning && (
        <Text type="secondary" style={{ fontSize: '11px', marginTop: '-6px' }}>
          {isInfinite ? 'No active debt' : meaning}
        </Text>
      )}
    </div>
  );
};
