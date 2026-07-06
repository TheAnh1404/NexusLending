import React from 'react';
import { Tag } from 'antd';
import type { LoanStatus } from '../../types';

interface LoanStatusBadgeProps {
  status: LoanStatus;
}

export const LoanStatusBadge: React.FC<LoanStatusBadgeProps> = ({ status }) => {
  let color = 'default';
  let label: string = status;

  switch (status) {
    case 'PendingCollateral':
      color = 'gold';
      label = 'PENDING COLLATERAL';
      break;
    case 'Active':
      color = 'processing'; // blue
      label = 'ACTIVE';
      break;
    case 'Warning':
      color = 'warning';
      label = 'WARNING';
      break;
    case 'LiquidationPlanning':
      color = 'error';
      label = 'LIQUIDATION PLANNING';
      break;
    case 'Repaid':
      color = 'success'; // green
      label = 'REPAID';
      break;
    case 'Liquidated':
      color = 'error'; // red/volcano
      label = 'LIQUIDATED';
      break;
    case 'Expired':
      color = 'default';
      label = 'EXPIRED';
      break;
    case 'Defaulted':
      color = 'volcano';
      label = 'DEFAULTED';
      break;
    case 'Closed':
      color = 'success';
      label = 'CLOSED';
      break;
  }

  return (
    <Tag
      color={color}
      style={{
        fontWeight: 600,
        borderRadius: '4px',
        padding: '2px 8px',
        textTransform: 'uppercase',
        fontSize: '11px',
        letterSpacing: '0.05em'
      }}
    >
      {label}
    </Tag>
  );
};
