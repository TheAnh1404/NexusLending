import React from 'react';
import { Tag, Tooltip } from 'antd';
import { getHealthCategory } from '../../utils/health';

interface HealthStatusProps {
  healthFactor: number;
  status?: string;
  showExact?: boolean;
}

export const HealthStatus: React.FC<HealthStatusProps> = ({ healthFactor, status, showExact = false }) => {
  const category = getHealthCategory(healthFactor, status);

  return (
    <Tooltip title={`Health Factor: ${healthFactor.toFixed(2)} (${category.label})`}>
      <Tag
        color={category.color}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontWeight: 600,
          margin: 0,
        }}
      >
        {category.icon}
        <span>{category.label}</span>
        {showExact && <span style={{ opacity: 0.8, fontSize: '11px' }}>({healthFactor.toFixed(2)})</span>}
      </Tag>
    </Tooltip>
  );
};
