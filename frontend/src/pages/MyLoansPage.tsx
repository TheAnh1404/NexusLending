import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { formatCurrency, formatAddress, getRiskZone, isOpenLoanStatus } from '../utils/finance';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { EmptyState } from '../components/common/CommonStates';
import { Card, Table, Tabs, Input, Button, Typography, Tag, Select } from 'antd';
import { Search, ArrowRight } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const MyLoansPage: React.FC = () => {
  const { wallet, loans } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'SAFE' | 'WARNING' | 'LIQUIDATION_PLANNING'>('ALL');

  // 1. Segment loan data
  const borrowedActive = loans.filter(
    (l) => l.borrower === wallet.address && isOpenLoanStatus(l.status)
  );
  const lentActive = loans.filter(
    (l) => l.lender === wallet.address && isOpenLoanStatus(l.status)
  );
  const closedLoans = loans.filter(
    (l) => (l.borrower === wallet.address || l.lender === wallet.address) && (l.status === 'Repaid' || l.status === 'Closed')
  );
  const liquidatedLoans = loans.filter(
    (l) => (l.borrower === wallet.address || l.lender === wallet.address) && l.status === 'Liquidated'
  );

  const filterBySearch = (list: typeof loans) => {
    return list.filter(
      (l) =>
        l.id.toLowerCase().includes(search.toLowerCase()) ||
        l.borrower.toLowerCase().includes(search.toLowerCase()) ||
        l.lender.toLowerCase().includes(search.toLowerCase())
    ).filter((l) => riskFilter === 'ALL' || (isOpenLoanStatus(l.status) && getRiskZone(l.healthFactor) === riskFilter));
  };

  // 2. Table Column Configurations
  const columns = [
    {
      title: 'Contract ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{text}</Text>,
    },
    {
      title: 'Principal',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => <Text strong>{formatCurrency(amount, record.asset)}</Text>,
    },
    {
      title: 'Counterparty',
      key: 'counterparty',
      render: (_: any, record: any) => {
        const isBorrower = record.borrower === wallet.address;
        const counterpart = isBorrower ? record.lender : record.borrower;
        const role = isBorrower ? 'LENDER' : 'BORROWER';
        return (
          <span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{formatAddress(counterpart)}</span>
            <Tag color={role === 'LENDER' ? 'green' : 'blue'} style={{ marginLeft: '6px', fontSize: '10px', border: 'none' }}>
              {role}
            </Tag>
          </span>
        );
      },
    },
    {
      title: 'APR / Duration',
      key: 'aprDuration',
      render: (_: any, record: any) => (
        <span>{record.apr}% APR / {record.duration} Days</span>
      ),
    },
    {
      title: 'Collateral',
      key: 'collateral',
      render: (_: any, record: any) => (
        <span>{record.collateralAmount.toLocaleString()} {record.collateralAsset}</span>
      ),
    },
    {
      title: 'Risk Rating',
      key: 'risk',
      render: (_: any, record: any) => {
        if (!isOpenLoanStatus(record.status)) return <Text type="secondary">N/A</Text>;
        return <RiskBadge healthFactor={record.healthFactor} />;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: any) => <LoanStatusBadge status={status} />,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          size="small"
          onClick={() => navigate(`/app/loans/${record.id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Details <ArrowRight size={12} />
        </Button>
      ),
    },
  ];

  const renderTabPane = (dataList: typeof loans, typeText: string) => {
    const list = filterBySearch(dataList);
    if (list.length === 0) {
      return (
        <EmptyState
          title={`No ${typeText} Contracts`}
          description="Your wallet history does not contain any contracts in this category."
        />
      );
    }
    return (
      <Table
        columns={columns}
        dataSource={list.map((l) => ({ ...l, key: l.id }))}
        pagination={false}
      />
    );
  };

  const tabItems = [
    {
      key: 'borrowed',
      label: `Borrowed Active (${borrowedActive.length})`,
      children: renderTabPane(borrowedActive, 'Borrowed'),
    },
    {
      key: 'lent',
      label: `Lent Active (${lentActive.length})`,
      children: renderTabPane(lentActive, 'Lent'),
    },
    {
      key: 'closed',
      label: `Settled / Repaid (${closedLoans.length})`,
      children: renderTabPane(closedLoans, 'Settled'),
    },
    {
      key: 'liquidated',
      label: `Liquidated (${liquidatedLoans.length})`,
      children: renderTabPane(liquidatedLoans, 'Liquidated'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            My Loans Ledger
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Review your historical borrower, lender, and settled loan positions on the Stellar Network.
          </Paragraph>
        </div>
      </div>

      {/* Search and Table Cards */}
      <Card styles={{ body: { padding: '24px' } }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <Input
            prefix={<Search size={16} style={{ color: 'var(--text-muted)', marginRight: 6 }} />}
            placeholder="Filter contracts by Contract ID or Counterparty address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            size="large"
            style={{ maxWidth: '480px', flex: '1 1 320px' }}
          />
          <Select
            value={riskFilter}
            onChange={setRiskFilter}
            size="large"
            style={{ width: 240 }}
            options={[
              { value: 'ALL', label: 'All Risk Zones' },
              { value: 'SAFE', label: 'Safe' },
              { value: 'WARNING', label: 'Warning' },
              { value: 'LIQUIDATION_PLANNING', label: 'Liquidation Planning' },
            ]}
          />
        </div>

        <Tabs defaultActiveKey="borrowed" items={tabItems} />
      </Card>
    </div>
  );
};

