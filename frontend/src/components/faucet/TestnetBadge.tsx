import React from 'react';
import { Tag } from 'antd';
import { ShieldAlert } from 'lucide-react';

export const TestnetBadge: React.FC = () => {
  return (
    <Tag
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 20,
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        borderColor: 'rgba(79, 70, 229, 0.25)',
        color: 'var(--primary-color, #4f46e5)',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      <ShieldAlert size={13} />
      <span>Stellar Testnet</span>
    </Tag>
  );
};
