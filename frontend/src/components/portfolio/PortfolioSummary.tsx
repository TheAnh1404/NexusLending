import React from 'react';
import { Row, Col, Card, Typography } from 'antd';
import { ArrowUpRight, ArrowDownRight, Lock, Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/finance';

const { Title, Text } = Typography;

interface PortfolioSummaryProps {
  netPositionUsd: number;
  totalLentUsd: number;
  activeLentCount: number;
  totalBorrowedDebtUsd: number;
  activeBorrowedCount: number;
  lockedCollateralUsd: number;
  lockedAssetCount: number;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({
  netPositionUsd,
  totalLentUsd,
  activeLentCount,
  totalBorrowedDebtUsd,
  activeBorrowedCount,
  lockedCollateralUsd,
  lockedAssetCount,
}) => {
  return (
    <Row gutter={[16, 16]}>
      {/* Card 1: Net Position */}
      <Col xs={24} sm={12} lg={6}>
        <Card className="card-premium" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
              Net Position
            </Text>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-color, #4f46e5)',
              }}
            >
              <Wallet size={16} />
            </div>
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
            ${netPositionUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Title>
        </Card>
      </Col>

      {/* Card 2: Total Lent */}
      <Col xs={24} sm={12} lg={6}>
        <Card className="card-premium" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
              Total Lent
            </Text>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success-color, #10b981)',
              }}
            >
              <ArrowUpRight size={16} />
            </div>
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: 'var(--success-color, #10b981)' }}>
            {formatCurrency(totalLentUsd, 'USDC')}
          </Title>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            {activeLentCount} Active Loans
          </Text>
        </Card>
      </Col>

      {/* Card 3: Total Borrowed */}
      <Col xs={24} sm={12} lg={6}>
        <Card className="card-premium" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
              Total Borrowed
            </Text>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--danger-color, #ef4444)',
              }}
            >
              <ArrowDownRight size={16} />
            </div>
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: 'var(--danger-color, #ef4444)' }}>
            {formatCurrency(totalBorrowedDebtUsd, 'USDC')}
          </Title>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            {activeBorrowedCount} Active Loans
          </Text>
        </Card>
      </Col>

      {/* Card 4: Locked Collateral */}
      <Col xs={24} sm={12} lg={6}>
        <Card className="card-premium" styles={{ body: { padding: '20px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
              Locked Collateral
            </Text>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f59e0b',
              }}
            >
              <Lock size={16} />
            </div>
          </div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
            ${lockedCollateralUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Title>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
            {lockedAssetCount} Assets Locked
          </Text>
        </Card>
      </Col>
    </Row>
  );
};
