import React, { useState } from 'react';
import { Card, Typography, Tabs, Button, Table, Tag, Space } from 'antd';
import { ArrowRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Loan } from '../../types';
import { calculateRepaymentAmount, formatCurrency, getDaysRemaining } from '../../utils/finance';
import { HealthStatus } from '../common/HealthStatus';
import { ManageLoanDrawer } from '../common/ManageLoanDrawer';

const { Title, Text, Paragraph } = Typography;

interface PositionSectionProps {
  borrowedLoans: Loan[];
  lentLoans: Loan[];
  onRefresh: () => void;
}

export const PositionSection: React.FC<PositionSectionProps> = ({ borrowedLoans, lentLoans, onRefresh }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'borrowing' | 'lending'>('borrowing');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const handleManage = (loan: Loan) => {
    setSelectedLoan(loan);
    setManageOpen(true);
  };

  const tabItems = [
    {
      key: 'borrowing',
      label: `Borrowing Positions (${borrowedLoans.length})`,
    },
    {
      key: 'lending',
      label: `Lending Positions (${lentLoans.length})`,
    },
  ];

  // Borrowing List Columns
  const borrowingColumns = [
    {
      title: 'Borrowed Principal',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number, row: Loan) => (
        <Space size={10}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: '#2775ca',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {row.asset.slice(0, 1)}
          </div>
          <div>
            <Text strong style={{ fontSize: 14 }}>{formatCurrency(val, row.asset)}</Text>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fixed {row.apr}% APR</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Outstanding Debt',
      dataIndex: 'outstandingDebt',
      key: 'outstandingDebt',
      render: (val: number, row: Loan) => (
        <Text strong style={{ color: 'var(--primary-color)', fontSize: 14 }}>
          {formatCurrency(val, row.asset)}
        </Text>
      ),
    },
    {
      title: 'Locked Collateral',
      dataIndex: 'collateralAmount',
      key: 'collateralAmount',
      render: (val: number, row: Loan) => (
        <Text style={{ fontSize: 13, fontWeight: 600 }}>
          {val.toLocaleString()} {row.collateralAsset}
        </Text>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (val: string) => {
        const daysLeft = getDaysRemaining(val);
        return (
          <Space size={4}>
            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
            <Text style={{ fontSize: 13, fontWeight: 600 }}>
              {daysLeft > 0 ? `${daysLeft} Days` : 'Overdue'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Health',
      key: 'health',
      render: (_: unknown, row: Loan) => (
        <HealthStatus healthFactor={row.healthFactor} status={row.status} />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: (_: unknown, row: Loan) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleManage(row)}
          style={{ borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span>Manage</span>
          <ArrowRight size={13} />
        </Button>
      ),
    },
  ];

  // Lending List Columns
  const lendingColumns = [
    {
      title: 'Lent Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number, row: Loan) => (
        <Space size={10}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {row.asset.slice(0, 1)}
          </div>
          <div>
            <Text strong style={{ fontSize: 14 }}>{formatCurrency(val, row.asset)}</Text>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.duration} Days Term</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Expected Return',
      key: 'expectedReturn',
      render: (_: unknown, row: Loan) => {
        const expectedTotal = calculateRepaymentAmount(row.amount, row.apr, row.duration);
        return (
          <div>
            <Text strong style={{ color: 'var(--success-color)', fontSize: 14 }}>
              {formatCurrency(expectedTotal, row.asset)}
            </Text>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.apr}% Fixed APR</div>
          </div>
        );
      },
    },
    {
      title: 'Collateral Backing',
      dataIndex: 'collateralAmount',
      key: 'collateralAmount',
      render: (val: number, row: Loan) => (
        <Text style={{ fontSize: 13, fontWeight: 600 }}>
          {val.toLocaleString()} {row.collateralAsset}
        </Text>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (val: string) => {
        const daysLeft = getDaysRemaining(val);
        return (
          <Space size={4}>
            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
            <Text style={{ fontSize: 13, fontWeight: 600 }}>
              {daysLeft > 0 ? `${daysLeft} Days` : 'Matured'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => (
        <Tag color="green" style={{ borderRadius: 4, fontWeight: 600 }}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: (_: unknown, row: Loan) => (
        <Button
          type="primary"
          size="small"
          onClick={() => handleManage(row)}
          style={{ borderRadius: 6, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span>Manage</span>
          <ArrowRight size={13} />
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
            Positions
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Active borrowing agreements and high-yield lending contracts.
          </Text>
        </div>

        <Button
          type="primary"
          onClick={() => navigate('/app/marketplace')}
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          Explore Marketplace
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'borrowing' | 'lending')}
        items={tabItems}
      />

      {/* Borrowing Positions List Table */}
      {activeTab === 'borrowing' && (
        borrowedLoans.length === 0 ? (
          <Card className="card-premium" styles={{ body: { padding: 32, textAlign: 'center' } }}>
            <Title level={5} style={{ margin: '0 0 6px 0' }}>No Active Borrowing Positions</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>Borrow USDC against your XLM collateral from the Marketplace.</Paragraph>
          </Card>
        ) : (
          <Card className="card-premium" styles={{ body: { padding: 0 } }}>
            <Table
              dataSource={borrowedLoans}
              columns={borrowingColumns}
              rowKey="id"
              pagination={false}
              scroll={{ x: 650 }}
            />
          </Card>
        )
      )}

      {/* Lending Positions List Table */}
      {activeTab === 'lending' && (
        lentLoans.length === 0 ? (
          <Card className="card-premium" styles={{ body: { padding: 32, textAlign: 'center' } }}>
            <Title level={5} style={{ margin: '0 0 6px 0' }}>No Active Lending Positions</Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>Create a lending offer to earn fixed annual yield.</Paragraph>
          </Card>
        ) : (
          <Card className="card-premium" styles={{ body: { padding: 0 } }}>
            <Table
              dataSource={lentLoans}
              columns={lendingColumns}
              rowKey="id"
              pagination={false}
              scroll={{ x: 650 }}
            />
          </Card>
        )
      )}

      {/* Shared Manage Loan Drawer */}
      <ManageLoanDrawer
        open={manageOpen}
        loan={selectedLoan}
        onClose={() => setManageOpen(false)}
        onSuccess={() => {
          setManageOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
};
