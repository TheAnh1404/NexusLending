import React from 'react';
import { Card, Typography, Button, Tag } from 'antd';
import { Clock, Percent, Shield, ArrowRight } from 'lucide-react';
import type { LoanOffer } from '../../types';
import { calculateRequiredCollateral, formatCurrency } from '../../utils/finance';

const { Text, Title } = Typography;

interface OfferCardProps {
  offer: LoanOffer;
  xlmPrice: number;
  onSelect: (offer: LoanOffer) => void;
  isOwner?: boolean;
}

export const OfferCard: React.FC<OfferCardProps> = ({ offer, xlmPrice, onSelect, isOwner }) => {
  const requiredCollateral = calculateRequiredCollateral(offer.amount, 1.0, xlmPrice, offer.maxLTV);

  return (
    <Card
      hoverable
      className="card-premium"
      style={{
        borderRadius: '12px',
        border: '1px solid var(--border-color, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      styles={{
        body: {
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: '16px',
        },
      }}
    >
      {/* Header: Amount & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text type="secondary" style={{ fontSize: '12px', fontWeight: 500 }}>
            Borrow Amount
          </Text>
          <Title level={3} style={{ margin: '2px 0 0 0', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
            {formatCurrency(offer.amount, offer.asset)}
          </Title>
        </div>
        <Tag color="green" style={{ borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>
          {offer.status || 'Active'}
        </Tag>
      </div>

      {/* Main Loan Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          padding: '12px',
          backgroundColor: 'var(--bg-color, #f8fafc)',
          borderRadius: '8px',
        }}
      >
        <div>
          <Text type="secondary" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Percent size={12} /> APR
          </Text>
          <Text strong style={{ fontSize: '15px', color: 'var(--primary-color, #4f46e5)' }}>
            {offer.apr}% APR
          </Text>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> Duration
          </Text>
          <Text strong style={{ fontSize: '15px' }}>
            {offer.duration} Days
          </Text>
        </div>
      </div>

      {/* Collateral Requirement */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
        <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Shield size={14} /> Required Collateral
        </Text>
        <Text strong style={{ color: 'var(--text-main)' }}>
          {Math.ceil(requiredCollateral).toLocaleString()} {offer.collateralAsset}
        </Text>
      </div>

      {/* Primary Action Button */}
      <Button
        type="primary"
        block
        size="large"
        onClick={() => onSelect(offer)}
        style={{
          borderRadius: '8px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        <span>{isOwner ? 'Manage Offer' : 'Borrow Now'}</span>
        <ArrowRight size={16} />
      </Button>
    </Card>
  );
};
