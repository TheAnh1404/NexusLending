import React from 'react';
import { Tag, Tooltip } from 'antd';
import type { RiskZone } from '../../types';
import { getRiskZone } from '../../utils/finance';

interface RiskBadgeProps {
  healthFactor?: number;
  zone?: RiskZone;
}

const riskMeta: Record<RiskZone, { color: string; label: string; meaning: string }> = {
  SAFE: {
    color: 'green',
    label: 'SAFE',
    meaning: 'HF >= 1.4. Position is healthy.',
  },
  WARNING: {
    color: 'orange',
    label: 'WARNING',
    meaning: '1.2 <= HF < 1.4. Needs attention.',
  },
  LIQUIDATION_PLANNING: {
    color: 'red',
    label: 'LIQUIDATION PLANNING',
    meaning: 'HF < 1.2. Eligible for liquidation planning.',
  },
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({ healthFactor, zone }) => {
  const finalZone = zone || (healthFactor !== undefined ? getRiskZone(healthFactor) : 'SAFE');
  const meta = riskMeta[finalZone];

  return (
    <Tooltip title={meta.meaning}>
      <Tag
        color={meta.color}
        style={{
          fontWeight: 600,
          borderRadius: '4px',
          padding: '2px 8px',
          border: 'none',
          textTransform: 'uppercase',
          fontSize: '11px',
          letterSpacing: '0.05em',
          marginInlineEnd: 0,
        }}
      >
        {meta.label}
      </Tag>
    </Tooltip>
  );
};
