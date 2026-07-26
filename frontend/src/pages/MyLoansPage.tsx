import React, { useState, useMemo } from 'react';
import { Typography, Tabs, Input, Select, Button, Table, Tag, Space, Card, Badge } from 'antd';
import {
  Search,
  Clock,
  ArrowRight,
  User,
  PlusCircle,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Hourglass,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OfferIdBadge } from '../components/common/OfferIdBadge';

import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import {
  calculateRepaymentAmount,
  formatAddress,
  formatCurrency,
  getDaysRemaining,
  isOpenLoanStatus,
} from '../utils/finance';
import { getConnectedWalletAddress, isSameWalletAddress } from '../utils/wallet';
import { EmptyState } from '../components/common/CommonStates';
import { HealthStatus } from '../components/common/HealthStatus';
import { ManageLoanDrawer } from '../components/common/ManageLoanDrawer';
import { CreateOfferWizardDrawer } from '../components/common/CreateOfferWizardDrawer';
import type { Loan } from '../types';

const { Title, Paragraph, Text } = Typography;

// ── Category definitions ────────────────────────────────────────────────

interface LoanCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
  match: (loan: Loan) => boolean;
  /** sort order – lower number renders first */
  order: number;
}

const BORROW_CATEGORIES: LoanCategory[] = [
  {
    key: 'pending',
    label: 'Pending Collateral',
    icon: <Hourglass size={16} />,
    color: '#faad14',
    badgeColor: 'orange',
    match: (l) => l.status === 'PendingCollateral',
    order: 0,
  },
  {
    key: 'active',
    label: 'Active Loans',
    icon: <ShieldCheck size={16} />,
    color: '#1677ff',
    badgeColor: 'blue',
    match: (l) => l.status === 'Active' && l.healthFactor >= 1.2,
    order: 1,
  },
  {
    key: 'at_risk',
    label: 'At Risk',
    icon: <AlertTriangle size={16} />,
    color: '#fa8c16',
    badgeColor: 'orange',
    match: (l) => (l.status === 'Active' || l.status === 'Warning' || l.status === 'LiquidationPlanning') && l.healthFactor < 1.2,
    order: 2,
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: <CheckCircle2 size={16} />,
    color: '#52c41a',
    badgeColor: 'green',
    match: (l) => l.status === 'Repaid' || l.status === 'Closed',
    order: 3,
  },
  {
    key: 'liquidated',
    label: 'Liquidated / Defaulted',
    icon: <XCircle size={16} />,
    color: '#ff4d4f',
    badgeColor: 'red',
    match: (l) => l.status === 'Liquidated' || l.status === 'Defaulted' || l.status === 'Expired',
    order: 4,
  },
];

const LEND_LOAN_CATEGORIES: LoanCategory[] = [
  {
    key: 'active_lent',
    label: 'Active Lent Loans',
    icon: <ShieldCheck size={16} />,
    color: '#1677ff',
    badgeColor: 'blue',
    match: (l) => isOpenLoanStatus(l.status),
    order: 0,
  },
  {
    key: 'completed_lent',
    label: 'Completed',
    icon: <CheckCircle2 size={16} />,
    color: '#52c41a',
    badgeColor: 'green',
    match: (l) => l.status === 'Repaid' || l.status === 'Closed',
    order: 1,
  },
  {
    key: 'liquidated_lent',
    label: 'Liquidated / Defaulted',
    icon: <XCircle size={16} />,
    color: '#ff4d4f',
    badgeColor: 'red',
    match: (l) => l.status === 'Liquidated' || l.status === 'Defaulted' || l.status === 'Expired',
    order: 2,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────

/** Sort loans newest‑first based on borrowTime. */
const sortNewestFirst = (a: Loan, b: Loan): number =>
  new Date(b.borrowTime).getTime() - new Date(a.borrowTime).getTime();

/**
 * Group an array of loans into categories. Each loan is placed in the
 * first matching category. Only categories with at least 1 loan are returned.
 */
function groupLoans(
  loans: Loan[],
  categories: LoanCategory[],
): { category: LoanCategory; loans: Loan[] }[] {
  const buckets = new Map<string, Loan[]>();
  for (const cat of categories) buckets.set(cat.key, []);

  for (const loan of loans) {
    for (const cat of categories) {
      if (cat.match(loan)) {
        buckets.get(cat.key)!.push(loan);
        break;
      }
    }
  }

  return categories
    .filter((cat) => (buckets.get(cat.key)?.length ?? 0) > 0)
    .map((cat) => ({
      category: cat,
      loans: buckets.get(cat.key)!.sort(sortNewestFirst),
    }));
}

// ── Component ───────────────────────────────────────────────────────────

export const MyLoansPage: React.FC = () => {
  const { wallet, loans, loanOffers, oraclePrices, refreshData } = useAppContext();
  const { publicKey } = useWallet();
  const navigate = useNavigate();

  const [activeMainTab, setActiveMainTab] = useState<'borrowing' | 'lending'>('borrowing');
  const [lendingSubTab, setLendingSubTab] = useState<'all' | 'borrowed' | 'pending'>('all');
  const [search, setSearch] = useState('');

  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [manageDrawerOpen, setManageDrawerOpen] = useState(false);
  const [createOfferOpen, setCreateOfferOpen] = useState(false);

  const userAddress = getConnectedWalletAddress(publicKey, wallet.address);
  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // ── Filtered source data ──────────────────────────────────────────────

  const myBorrowedLoans = useMemo(
    () =>
      loans
        .filter((l) => isSameWalletAddress(l.borrower, userAddress))
        .filter(
          (l) =>
            l.id.toLowerCase().includes(search.toLowerCase()) ||
            l.lender.toLowerCase().includes(search.toLowerCase()),
        ),
    [loans, userAddress, search],
  );

  const myLentLoans = useMemo(
    () =>
      loans
        .filter((l) => isSameWalletAddress(l.lender, userAddress))
        .filter(
          (l) =>
            l.id.toLowerCase().includes(search.toLowerCase()) ||
            l.borrower.toLowerCase().includes(search.toLowerCase()),
        ),
    [loans, userAddress, search],
  );

  const myPendingOffers = useMemo(
    () =>
      loanOffers
        .filter((o) => isSameWalletAddress(o.lender, userAddress) && o.status === 'Active')
        .filter((o) => o.id.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime()),
    [loanOffers, userAddress, search],
  );

  // ── Grouped buckets ──────────────────────────────────────────────────

  const borrowGroups = useMemo(() => groupLoans(myBorrowedLoans, BORROW_CATEGORIES), [myBorrowedLoans]);
  const lendGroups = useMemo(() => groupLoans(myLentLoans, LEND_LOAN_CATEGORIES), [myLentLoans]);

  const handleManageLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setManageDrawerOpen(true);
  };

  // ── Table column builders ─────────────────────────────────────────────

  const borrowedColumns = [
    {
      title: 'Borrow Principal & Debt',
      key: 'principal',
      render: (_: unknown, record: Loan) => (
        <div>
          <Text strong style={{ fontSize: 15, color: 'var(--text-main)' }}>
            {formatCurrency(record.amount, record.asset)}
          </Text>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Debt: <Text strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(record.outstandingDebt, record.asset)}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Collateral Locked',
      key: 'collateral',
      render: (_: unknown, record: Loan) => (
        <div>
          <Text strong>{record.collateralAmount.toLocaleString()} {record.collateralAsset}</Text>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            ${(record.collateralAmount * xlmPrice).toFixed(2)} USD
          </div>
        </div>
      ),
    },
    {
      title: 'Fixed APR & Due Date',
      key: 'aprDuration',
      render: (_: unknown, record: Loan) => {
        const daysLeft = getDaysRemaining(record.dueDate);
        return (
          <div>
            <Tag color="purple" style={{ borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
              {record.apr}% APR
            </Tag>
            <div style={{ fontSize: 12, marginTop: 4, color: daysLeft <= 3 ? 'var(--warning-color)' : 'var(--text-muted)' }}>
              {daysLeft > 0 ? `${daysLeft} Days left (${record.dueDate})` : 'Overdue'}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Health Status',
      key: 'health',
      render: (_: unknown, record: Loan) => (
        <HealthStatus healthFactor={record.healthFactor} status={record.status} showExact />
      ),
    },
    {
      title: 'Loan Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'Repaid' || status === 'Closed') color = 'green';
        if (status === 'Liquidated') color = 'red';
        if (status === 'PendingCollateral') color = 'orange';
        if (status === 'Warning' || status === 'LiquidationPlanning') color = 'volcano';
        return (
          <Tag color={color} style={{ borderRadius: 4, fontWeight: 600 }}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: (_: unknown, record: Loan) => (
        <Button
          type="primary"
          onClick={() => handleManageLoan(record)}
          style={{ borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span>Manage Loan</span>
          <ArrowRight size={14} />
        </Button>
      ),
    },
  ];

  const lendingLoanColumns = [
    {
      title: 'Lending Principal',
      key: 'amount',
      render: (_: unknown, record: Loan) => (
        <Text strong style={{ fontSize: 15, color: 'var(--text-main)' }}>
          {formatCurrency(record.amount, record.asset)}
        </Text>
      ),
    },
    {
      title: 'Borrower',
      key: 'borrower',
      render: (_: unknown, record: Loan) => (
        <Tag color="cyan" icon={<User size={12} style={{ marginRight: 4 }} />} style={{ borderRadius: 4, fontWeight: 600 }}>
          {formatAddress(record.borrower)}
        </Tag>
      ),
    },
    {
      title: 'APR & Yield',
      key: 'aprYield',
      render: (_: unknown, record: Loan) => {
        const expectedTotal = calculateRepaymentAmount(record.amount, record.apr, record.duration);
        const expectedProfit = expectedTotal - record.amount;
        return (
          <div>
            <Tag color="purple" style={{ borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
              {record.apr}% APR
            </Tag>
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--success-color)', fontWeight: 600 }}>
              +{formatCurrency(expectedProfit, record.asset)} Interest
            </div>
          </div>
        );
      },
    },
    {
      title: 'Due Date',
      key: 'duration',
      render: (_: unknown, record: Loan) => (
        <Space size={4}>
          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
          <Text strong>
            {record.dueDate ? `Due: ${record.dueDate}` : `${record.duration} Days`}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'statusTag',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'Repaid' || status === 'Closed') color = 'green';
        if (status === 'Liquidated') color = 'red';
        return (
          <Tag color={color} style={{ borderRadius: 4, fontWeight: 600 }}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: (_: unknown, record: Loan) => (
        <Button
          type="primary"
          onClick={() => handleManageLoan(record)}
          style={{ borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span>Manage Position</span>
          <ArrowRight size={14} />
        </Button>
      ),
    },
  ];

  // ── Pending offers table (for Lending tab) ────────────────────────────

  const pendingOfferColumns = [
    {
      title: 'Offer ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <OfferIdBadge id={id} />,
    },

    {
      title: 'Offer Amount',
      key: 'amount',

      render: (_: unknown, record: typeof myPendingOffers[0]) => (
        <Text strong style={{ fontSize: 15, color: 'var(--text-main)' }}>
          {formatCurrency(record.amount, record.asset)}
        </Text>
      ),
    },
    {
      title: 'APR & Expected Yield',
      key: 'aprYield',
      render: (_: unknown, record: typeof myPendingOffers[0]) => {
        const expectedTotal = calculateRepaymentAmount(record.amount, record.apr, record.duration);
        const expectedProfit = expectedTotal - record.amount;
        return (
          <div>
            <Tag color="purple" style={{ borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
              {record.apr}% APR
            </Tag>
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--success-color)', fontWeight: 600 }}>
              +{formatCurrency(expectedProfit, record.asset)} Interest
            </div>
          </div>
        );
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: unknown, record: typeof myPendingOffers[0]) => (
        <Space size={4}>
          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
          <Text strong>{record.duration} Days</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: () => (
        <Tag color="orange" style={{ borderRadius: 4, fontWeight: 600 }}>
          Awaiting Borrower
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: () => (
        <Button
          type="default"
          onClick={() => navigate('/app/marketplace')}
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          View Marketplace
        </Button>
      ),
    },
  ];

  // ── Category section header styles ────────────────────────────────────

  const renderCategoryHeader = (cat: LoanCategory, count: number) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: `${cat.color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: cat.color,
        }}
      >
        {cat.icon}
      </div>
      <Text strong style={{ fontSize: 15 }}>{cat.label}</Text>
      <Badge
        count={count}
        style={{
          backgroundColor: cat.color,
          fontWeight: 700,
          fontSize: 12,
          boxShadow: 'none',
        }}
      />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────

  const mainTabItems = [
    {
      key: 'borrowing',
      label: `My Borrowing (${myBorrowedLoans.length})`,
    },
    {
      key: 'lending',
      label: `My Lending (${myLentLoans.length + myPendingOffers.length})`,
    },
  ];

  const hasBorrowData = borrowGroups.length > 0;
  const hasLendData = lendGroups.length > 0 || (lendingSubTab !== 'borrowed' && myPendingOffers.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800 }}>
            My Loans
          </Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 14 }}>
            Monitor and manage your active borrowing and lending positions in real time.
          </Paragraph>
        </div>

        <Button
          type="primary"
          icon={<PlusCircle size={16} />}
          onClick={() => setCreateOfferOpen(true)}
          style={{ borderRadius: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          Create Offer
        </Button>
      </div>

      {/* Main Role Tabs */}
      <Tabs
        activeKey={activeMainTab}
        onChange={(k) => setActiveMainTab(k as 'borrowing' | 'lending')}
        items={mainTabItems}
        size="large"
      />

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--border-color, #e2e8f0)',
        }}
      >
        <Input
          placeholder="Search loan ID or wallet address..."
          prefix={<Search size={16} style={{ color: 'var(--text-muted)' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, borderRadius: 8 }}
          allowClear
        />

        {activeMainTab === 'lending' && (
          <Select
            value={lendingSubTab}
            onChange={(val) => setLendingSubTab(val as 'all' | 'borrowed' | 'pending')}
            style={{ width: 220 }}
            options={[
              { value: 'all', label: 'All Lending Positions' },
              { value: 'borrowed', label: 'Has Borrower (Active Loan)' },
              { value: 'pending', label: 'Awaiting Borrower (Open Offer)' },
            ]}
          />
        )}
      </div>

      {/* ── BORROWING TAB ──────────────────────────────────────────────── */}
      {activeMainTab === 'borrowing' && (
        !hasBorrowData ? (
          <EmptyState
            title="No borrowing loans found"
            description="You do not have any active loans matching your search filters."
            action={
              <Button type="primary" onClick={() => navigate('/app/marketplace')}>
                Go to Marketplace
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {borrowGroups.map(({ category, loans: groupLoans }) => (
              <Card
                key={category.key}
                className="card-premium"
                styles={{ body: { padding: 0 } }}
                style={{
                  borderTop: `3px solid ${category.color}`,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  {renderCategoryHeader(category, groupLoans.length)}
                </div>
                <Table
                  columns={borrowedColumns}
                  dataSource={groupLoans}
                  rowKey="id"
                  pagination={groupLoans.length > 5 ? { pageSize: 5, size: 'small' } : false}
                />
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── LENDING TAB ────────────────────────────────────────────────── */}
      {activeMainTab === 'lending' && (
        !hasLendData ? (
          <EmptyState
            title="No lending positions found"
            description="You do not have any lending offers or active loans where you are the lender."
            action={
              <Button type="primary" icon={<PlusCircle size={16} />} onClick={() => setCreateOfferOpen(true)}>
                Create Lending Offer
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Grouped Lent Loan Categories */}
            {lendingSubTab !== 'pending' && lendGroups.map(({ category, loans: groupLoans }) => (
              <Card
                key={category.key}
                className="card-premium"
                styles={{ body: { padding: 0 } }}
                style={{
                  borderTop: `3px solid ${category.color}`,
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  {renderCategoryHeader(category, groupLoans.length)}
                </div>
                <Table
                  columns={lendingLoanColumns}
                  dataSource={groupLoans}
                  rowKey="id"
                  pagination={groupLoans.length > 5 ? { pageSize: 5, size: 'small' } : false}
                />
              </Card>
            ))}

            {/* Pending Offers Section */}
            {lendingSubTab !== 'borrowed' && myPendingOffers.length > 0 && (
              <Card
                className="card-premium"
                styles={{ body: { padding: 0 } }}
                style={{
                  borderTop: '3px solid #faad14',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  {renderCategoryHeader(
                    {
                      key: 'pending_offers',
                      label: 'Open Offers (Awaiting Borrower)',
                      icon: <Hourglass size={16} />,
                      color: '#faad14',
                      badgeColor: 'orange',
                      match: () => true,
                      order: 99,
                    },
                    myPendingOffers.length,
                  )}
                </div>
                <Table
                  columns={pendingOfferColumns}
                  dataSource={myPendingOffers}
                  rowKey="id"
                  pagination={myPendingOffers.length > 5 ? { pageSize: 5, size: 'small' } : false}
                />
              </Card>
            )}
          </div>
        )
      )}

      {/* Integrated Manage Loan Drawer */}
      <ManageLoanDrawer
        open={manageDrawerOpen}
        loan={selectedLoan}
        onClose={() => setManageDrawerOpen(false)}
        onSuccess={() => {
          setManageDrawerOpen(false);
          refreshData();
        }}
      />

      {/* Create Offer Wizard */}
      <CreateOfferWizardDrawer
        open={createOfferOpen}
        onClose={() => setCreateOfferOpen(false)}
        onSuccess={() => {
          setCreateOfferOpen(false);
          refreshData();
        }}
      />
    </div>
  );
};
