import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { formatCurrency, formatAddress, getRiskZone, isOpenLoanStatus } from '../utils/finance';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { EmptyState } from '../components/common/CommonStates';
import { motion } from 'framer-motion';
import { 
  Card, 
  Table, 
  Tabs, 
  Input, 
  Button, 
  Typography, 
  Tag, 
  Select, 
  Space, 
  Divider, 
  Badge, 
  Progress, 
  message, 
  Row, 
  Col 
} from 'antd';
import { 
  Search, 
  ArrowRight, 
  Copy, 
  Check, 
  RefreshCw, 
  Wallet, 
  Coins, 
  ShieldCheck, 
  Briefcase, 
  Info
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const MyLoansPage: React.FC = () => {
  const { wallet, loans, oraclePrices, refreshData } = useAppContext();
  const navigate = useNavigate();
  
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'SAFE' | 'WARNING' | 'LIQUIDATION_PLANNING'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

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

  // Statistics Calculations
  const totalBorrowedDebt = borrowedActive.reduce((sum, l) => sum + l.outstandingDebt, 0);
  const totalLentPrincipal = lentActive.reduce((sum, l) => sum + l.amount, 0);
  
  // Total collateral locked under user active agreements
  const totalLockedCollateral = loans
    .filter((l) => (l.borrower === wallet.address || l.lender === wallet.address) && isOpenLoanStatus(l.status))
    .reduce((sum, l) => sum + (l.collateralAmount * xlmPrice), 0);

  const totalSettledCount = closedLoans.length;

  const handleCopyText = (text: string, idStr: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idStr);
    setTimeout(() => setCopiedId(null), 1500);
    message.success('Copied to clipboard');
  };

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
      title: 'Contract / Loan ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => (
        <Space size={4}>
          <Text strong style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{formatAddress(text)}</Text>
          <Button
            type="text"
            size="small"
            icon={copiedId === text ? <Check size={12} style={{ color: 'var(--success-color)' }} /> : <Copy size={12} />}
            onClick={() => handleCopyText(text, text)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        </Space>
      ),
    },
    {
      title: 'Principal Debt',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>{formatCurrency(amount, record.asset)}</Text>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>USDC Escrow Locked</div>
        </div>
      ),
    },
    {
      title: 'Counterparty Role',
      key: 'counterparty',
      render: (_: any, record: any) => {
        const isBorrower = record.borrower === wallet.address;
        const counterpart = isBorrower ? record.lender : record.borrower;
        const role = isBorrower ? 'LENDER' : 'BORROWER';
        return (
          <div>
            <Space size={4} align="center">
              <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatAddress(counterpart)}</Text>
              <Button
                type="text"
                size="small"
                icon={copiedId === counterpart ? <Check size={12} style={{ color: 'var(--success-color)' }} /> : <Copy size={12} />}
                onClick={() => handleCopyText(counterpart, counterpart)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px' }}
              />
            </Space>
            <div style={{ marginTop: '2px' }}>
              <Tag color={role === 'LENDER' ? 'green' : 'blue'} style={{ fontSize: '10px', border: 'none', margin: 0, fontWeight: 600 }}>
                {role === 'LENDER' ? 'Credited from Lender' : 'Debt from Borrower'}
              </Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Fixed Terms',
      key: 'aprDuration',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: 'var(--primary-color)' }}>{record.apr}% APR</Text>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{record.duration} Days term</span>
        </Space>
      ),
    },
    {
      title: 'Locked Collateral',
      key: 'collateral',
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ fontSize: '13px' }}>{record.collateralAmount.toLocaleString()} {record.collateralAsset}</Text>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Valued: ${ (record.collateralAmount * xlmPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } USD
          </div>
        </div>
      ),
    },
    {
      title: 'Risk Rating',
      key: 'risk',
      render: (_: any, record: any) => {
        if (!isOpenLoanStatus(record.status)) return <Text type="secondary">—</Text>;
        const hf = record.healthFactor;
        
        let strokeColor = "var(--success-color)";
        if (hf < 1.2) {
          strokeColor = "var(--danger-color)";
        } else if (hf < 1.4) {
          strokeColor = "var(--warning-color)";
        }

        const percentVal = Math.min((hf / 3) * 100, 100);

        return (
          <div style={{ minWidth: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <Text strong style={{ fontSize: '13px' }}>{hf.toFixed(2)}</Text>
              <RiskBadge healthFactor={hf} />
            </div>
            <Progress 
              percent={percentVal} 
              showInfo={false} 
              strokeColor={strokeColor} 
              size="small"
              style={{ margin: 0 }}
            />
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: any) => <LoanStatusBadge status={status} />,
    },
    {
      title: 'Action Ledger',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          type="primary"
          ghost
          size="small"
          onClick={() => navigate(`/app/loans/${record.id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}
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
          description="Your wallet history does not contain any active or past contracts in this category."
        />
      );
    }
    return (
      <Table
        columns={columns}
        dataSource={list.map((l) => ({ ...l, key: l.id }))}
        pagination={{ pageSize: 5 }}
        style={{ overflowX: 'auto' }}
      />
    );
  };

  const tabItems = [
    {
      key: 'borrowed',
      label: (
        <Badge count={filterBySearch(borrowedActive).length} offset={[10, -2]} size="small" color="var(--primary-color)">
          <span style={{ fontSize: '14px', fontWeight: 600, paddingRight: '8px' }}>Borrowed Active</span>
        </Badge>
      ),
      children: <div style={{ marginTop: '8px' }}>{renderTabPane(borrowedActive, 'Borrowed')}</div>,
    },
    {
      key: 'lent',
      label: (
        <Badge count={filterBySearch(lentActive).length} offset={[10, -2]} size="small" color="var(--secondary-color)">
          <span style={{ fontSize: '14px', fontWeight: 600, paddingRight: '8px' }}>Lent Active</span>
        </Badge>
      ),
      children: <div style={{ marginTop: '8px' }}>{renderTabPane(lentActive, 'Lent')}</div>,
    },
    {
      key: 'closed',
      label: (
        <Badge count={filterBySearch(closedLoans).length} offset={[10, -2]} size="small" color="var(--success-color)">
          <span style={{ fontSize: '14px', fontWeight: 600, paddingRight: '8px' }}>Settled / Repaid</span>
        </Badge>
      ),
      children: <div style={{ marginTop: '8px' }}>{renderTabPane(closedLoans, 'Settled')}</div>,
    },
    {
      key: 'liquidated',
      label: (
        <Badge count={filterBySearch(liquidatedLoans).length} offset={[10, -2]} size="small" color="var(--danger-color)">
          <span style={{ fontSize: '14px', fontWeight: 600, paddingRight: '8px' }}>Liquidated</span>
        </Badge>
      ),
      children: <div style={{ marginTop: '8px' }}>{renderTabPane(liquidatedLoans, 'Liquidated')}</div>,
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '40px' }}
    >
      
      {/* 1. Header Banner */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)', 
          borderRadius: 'var(--radius-xl)', 
          padding: '32px',
          boxShadow: 'var(--shadow-premium)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-30%', left: '10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Space direction="vertical" size={4}>
          <span style={{ color: 'var(--secondary-color)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            On-Chain Ledger
          </span>
          <Title level={1} style={{ margin: 0, color: '#ffffff', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '32px', letterSpacing: '-0.03em' }}>
            My Loans Ledger
          </Title>
          <Paragraph style={{ margin: '8px 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '15px', maxWidth: '750px', lineHeight: 1.5 }}>
            Verify, track, and manage your custom borrowing, lending, and settled escrow positions on the Stellar Soroban network.
          </Paragraph>
        </Space>
      </div>

      {/* 2. Stats cards row */}
      <Row gutter={[16, 16]}>
        
        {/* Card 1 */}
        <Col xs={24} sm={12} lg={6}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary-color)' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Active Borrows</Text>
                  <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {formatCurrency(totalBorrowedDebt, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary-color)' }}>
                  <Wallet size={18} />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Your total outstanding liabilities
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 2 */}
        <Col xs={24} sm={12} lg={6}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--secondary-color)' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Active Lends</Text>
                  <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {formatCurrency(totalLentPrincipal, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.08)', color: 'var(--secondary-color)' }}>
                  <Coins size={18} />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Liquidity active in contract agreements
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 3 */}
        <Col xs={24} sm={12} lg={6}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--success-color)' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Locked Collateral</Text>
                  <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--success-color)' }}>
                    {formatCurrency(totalLockedCollateral, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--success-color)' }}>
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                USD value of locked escrow XLM
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 4 */}
        <Col xs={24} sm={12} lg={6}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--warning-color)' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Settled Agreements</Text>
                  <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {totalSettledCount}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--warning-color)' }}>
                  <Briefcase size={18} />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Fully repaid and closed contracts
              </div>
            </Card>
          </motion.div>
        </Col>

      </Row>

      {/* 3. Search and Ledger Table */}
      <Card 
        styles={{ body: { padding: '24px' } }}
        style={{ 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filters Toolbar */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              prefix={<Search size={15} style={{ color: 'var(--text-muted)' }} />}
              placeholder="Search Contract ID or counterparty address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: '100%', maxWidth: '380px', borderRadius: 'var(--radius-sm)' }}
            />
            
            <Select
              value={riskFilter}
              onChange={setRiskFilter}
              style={{ width: '180px' }}
              options={[
                { value: 'ALL', label: 'All Risk Zones' },
                { value: 'SAFE', label: 'Safe Zone' },
                { value: 'WARNING', label: 'Warning Zone' },
                { value: 'LIQUIDATION_PLANNING', label: 'Liquidation Planning' },
              ]}
            />

            <Button 
              type="text" 
              icon={<RefreshCw size={14} />} 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}
              onClick={async () => {
                try {
                  await refreshData();
                  message.success('Ledger records updated');
                } catch (error) {
                  message.error(error instanceof Error ? error.message : 'Unable to sync ledger records');
                }
              }}
            >
              Sync Ledger
            </Button>
          </div>

          <Divider style={{ margin: 0 }} />

          <Tabs defaultActiveKey="borrowed" items={tabItems} />

        </div>
      </Card>
      
      {/* 4. Isolated contract specs block */}
      <div 
        style={{ 
          background: 'rgba(79, 70, 229, 0.02)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '20px 24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}
      >
        <Info size={20} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <Text strong style={{ fontSize: '14px', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
            Smart contract state verification
          </Text>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            All entries listed in this ledger sync with individual isolated escrow contracts deployed on the Stellar network. 
            When you repay debt or add collateral, consensus is reached instantly and changes are irreversibly written to the Stellar ledger. 
            You can verify each transaction receipt details by expanding the contract specifications page.
          </span>
        </div>
      </div>

    </motion.div>
  );
};
