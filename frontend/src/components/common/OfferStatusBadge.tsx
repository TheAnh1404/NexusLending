import React from 'react';
import { Tag } from 'antd';
import type { OfferStatus } from '../../types';

const offerStatusMeta: Record<OfferStatus, { color: string; label: string }> = {
  Draft: { color: 'default', label: 'Draft' },
  Funding: { color: 'gold', label: 'Funding' },
  Active: { color: 'processing', label: 'Active' },
  Matched: { color: 'success', label: 'Matched' },
  Cancelled: { color: 'default', label: 'Cancelled' },
  Expired: { color: 'default', label: 'Expired' },
};

interface OfferStatusBadgeProps {
  status?: OfferStatus;
}

export const OfferStatusBadge: React.FC<OfferStatusBadgeProps> = ({ status = 'Draft' }) => {
  const meta = offerStatusMeta[status];

  return (
    <Tag
      color={meta.color}
      style={{
        fontWeight: 600,
        borderRadius: '4px',
        padding: '2px 8px',
        textTransform: 'uppercase',
        fontSize: '11px',
        letterSpacing: '0.05em',
        marginInlineEnd: 0,
      }}
    >
      {meta.label}
    </Tag>
  );
};

