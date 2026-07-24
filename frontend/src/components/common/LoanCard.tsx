import React from 'react';
import { Card, Typography, Button, Tag } from 'antd';
import { ArrowRight } from 'lucide-react';
import type { Loan } from '../../types';
import { formatCurrency, getDaysRemaining } from '../../utils/finance';
import { HealthStatus } from './HealthStatus';

const { Text, Title } = Typography;

interface LoanCardProps {
  loan: Loan;
  role: 'borrower' | 'lender';
  onManage: (loan: Loan) => void;
}

export const LoanCard: React.FC<LoanCardProps> = ({ loan, role, onManage }) => {
  const daysRemaining = getDaysRemaining(loan.dueDate);

  return (
    <Card
      hoverable
      className="card-premium"
      style={{
        borderRadius: '12px',
        border: '1px solid var(--border-color, #e2e8f0)',
      }}
      styles={{
        body: {
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        },
      }}
    >
      {/* Header: Amount & Health */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text type="secondary" style={{ fontSize: '12px', fontWeight: 500 }}>
            {role === 'borrower' ? 'Borrowed Principal' : 'Lent Principal'}
          </Text>
          <Title level={3} style={{ margin: '2px 0 0 0', fontWeight: 800 }}>
            {formatCurrency(loan.amount, loan.asset)}
          </Title>
        </div>
        <HealthStatus healthFactor={loan.healthFactor} status={loan.status} />
      </div>

      {/* Main Info Box */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          padding: '12px',
          backgroundColor: 'var(--bg-color, #f8fafc)',
          borderRadius: '8px',
          fontSize: '13px',
        }}
      >
        <div>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            Outstanding Debt
          </Text>
          <div>
            <Text strong style={{ color: 'var(--primary-color)' }}>
              {formatCurrency(loan.outstandingDebt, loan.asset)}
            </Text>
          </div>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            Time Remaining
          </Text>
          <div>
            <Text strong>
              {daysRemaining > 0 ? `${daysRemaining} Days` : 'Due Today'}
            </Text>
          </div>
        </div>
      </div>

      {/* Status & CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tag color="blue" style={{ borderRadius: '4px', fontWeight: 600, margin: 0 }}>
          {loan.status}
        </Tag>
        <Button
          type="primary"
          onClick={() => onManage(loan)}
          style={{ borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span>Manage</span>
          <ArrowRight size={14} />
        </Button>
      </div>
    </Card>
  );
};
