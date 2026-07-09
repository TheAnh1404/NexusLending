import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateInterestAmount, formatCurrency, formatAddress, isOpenLoanStatus } from '../utils/finance';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import { OfferStatusBadge } from '../components/common/OfferStatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { EmptyState } from '../components/common/CommonStates';
import { motion } from 'framer-motion';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Space,
  Typography,
  Tabs,
  Input,
  Select,
  Tooltip,
  Badge,
  Progress,
  Divider,
  InputNumber,
  message,
  Tag,
} from 'antd';
import {
  Coins,
  TrendingUp,
  FileBadge,
  CheckCircle,
  AlertTriangle,
  Search,
  Calculator,
  Copy,
  Check,
  Calendar,
  ExternalLink,
  Plus,
  RefreshCw,
  Wallet,
  Percent,
  Briefcase,
  ShieldCheck
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const { Title, Paragraph, Text } = Typography;

export const LenderDashboardPage: React.FC = () => {
  const { wallet, loans, loanOffers, activities, fundOffer, activateOffer, cancelOffer } = useAppContext();
  const navigate = useNavigate();

  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('ALL');
  const [activeTab, setActiveTab] = useState('loans');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Yield calculator state
  const [calcAmount, setCalcAmount] = useState<number>(1000);
  const [calcApr, setCalcApr] = useState<number>(12);
  const [calcDuration, setCalcDuration] = useState<number>(30);

  // Filter loans where this user is the lender
  const lenderLoans = loans.filter((l) => l.lender === wallet.address);
  const lenderLoanIds = new Set(lenderLoans.map((loan) => loan.id));
  const lenderOffers = loanOffers.filter((offer) => offer.lender === wallet.address);
  const fundingOffers = lenderOffers.filter((offer) => offer.status === 'Funding');
  const repaymentTransactions = activities.filter((tx) =>
    ['PARTIAL_REPAY', 'FULL_REPAY', 'REPAY'].includes(tx.type)
    && tx.loanId
    && lenderLoanIds.has(tx.loanId)
  );

  // Active Lender Loans
  const activeLoans = lenderLoans.filter((l) => isOpenLoanStatus(l.status));
  const activeLoansCount = activeLoans.length;

  // Completed Loans
  const completedLoans = lenderLoans.filter((l) => l.status === 'Repaid' || l.status === 'Closed');
  const completedLoansCount = completedLoans.length;

  // Liquidated Loans
  const liquidatedLoans = lenderLoans.filter((l) => l.status === 'Liquidated');
  const liquidatedLoansCount = liquidatedLoans.length;

  // Stats calculations
  const totalLentVal = activeLoans.reduce((sum, l) => sum + l.amount, 0);
  const totalExpectedInterest = activeLoans.reduce((sum, l) => {
    return sum + calculateInterestAmount(l.amount, l.apr, l.duration);
  }, 0);

  const totalRepaymentsReceived = repaymentTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  
  // Calculate average APR
  const averageApr = activeLoans.length > 0
    ? activeLoans.reduce((sum, l) => sum + l.apr, 0) / activeLoans.length
    : 0;

  // Clipboard handler
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    message.success('Copied to clipboard');
  };

  // Yield calculator formula
  const calculatedYield = (calcAmount * (calcApr / 100) * (calcDuration / 365));
  const calculatedTotalRepayment = calcAmount + calculatedYield;

  // Filter data helper
  const filterData = <T extends { id: string; asset: string; borrower?: string; lender?: string }>(data: T[]): T[] => {
    return data.filter((item) => {
      const matchesSearch =
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.borrower && item.borrower.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.lender && item.lender.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesAsset = selectedAsset === 'ALL' || item.asset.toUpperCase() === selectedAsset.toUpperCase();
      return matchesSearch && matchesAsset;
    });
  };

  // Sparkline data
  const mockYieldHistory = [
    { date: '07-03', Yield: 10.50, Principal: totalLentVal * 0.4 },
    { date: '07-04', Yield: 32.20, Principal: totalLentVal * 0.6 },
    { date: '07-05', Yield: 55.80, Principal: totalLentVal * 0.7 },
    { date: '07-06', Yield: 92.40, Principal: totalLentVal * 0.85 },
    { date: '07-07', Yield: 145.00, Principal: totalLentVal * 0.9 },
    { date: '07-08', Yield: 210.15, Principal: totalLentVal * 0.95 },
    { date: '07-09', Yield: totalExpectedInterest > 0 ? totalExpectedInterest : 285.50, Principal: totalLentVal || 5000 },
  ];

  // Helper to calculate days remaining
  const getDaysRemainingText = (dueDateStr: string, status: string) => {
    if (!isOpenLoanStatus(status)) return { text: 'N/A', color: 'var(--text-muted)' };
    
    const dueDate = new Date(dueDateStr);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, color: 'var(--danger-color)' };
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'var(--warning-color)' };
    } else if (diffDays <= 3) {
      return { text: `Due in ${diffDays}d`, color: 'var(--warning-color)' };
    }
    return { text: `${diffDays} days left`, color: 'var(--success-color)' };
  };

  // Column definitions for active loans
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
      title: 'Borrower',
      dataIndex: 'borrower',
      key: 'borrower',
      render: (text: string) => (
        <Tooltip title={text}>
          <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatAddress(text)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Principal Lent',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>{formatCurrency(amount, record.asset)}</Text>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Collateral: {record.collateralAmount} {record.collateralAsset}
          </div>
        </div>
      ),
    },
    {
      title: 'Fixed Terms',
      key: 'terms',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Tag color="purple" style={{ border: 'none', margin: 0, fontWeight: 600 }}>{record.apr}% APR</Tag>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{record.duration} Days</span>
        </Space>
      ),
    },
    {
      title: 'Health Factor',
      dataIndex: 'healthFactor',
      key: 'healthFactor',
      render: (hf: number, record: any) => {
        if (!isOpenLoanStatus(record.status)) return <Text type="secondary">—</Text>;
        
        let strokeColor = "var(--success-color)";
        if (hf < 1.2) {
          strokeColor = "var(--danger-color)";
        } else if (hf < 1.4) {
          strokeColor = "var(--warning-color)";
        }

        const percentVal = Math.min((hf / 3) * 100, 100);

        return (
          <div style={{ minWidth: '120px' }}>
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
      title: 'Contract Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: any) => <LoanStatusBadge status={status} />,
    },
    {
      title: 'Maturity / Due',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string, record: any) => {
        if (!isOpenLoanStatus(record.status)) return <Text type="secondary">—</Text>;
        const daysRemaining = getDaysRemainingText(date, record.status);
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
              <span>{new Date(date).toLocaleDateString()}</span>
            </div>
            <span style={{ fontSize: '11px', color: daysRemaining.color, fontWeight: 600 }}>
              {daysRemaining.text}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button 
            type="primary" 
            ghost
            size="small" 
            style={{ borderRadius: '6px' }}
            onClick={() => navigate(`/app/loans/${record.id}`)}
          >
            View
          </Button>
          {record.status === 'Repaid' && (
            <Badge status="success" text="Direct Transferred" style={{ fontSize: '11px', fontWeight: 600 }} />
          )}
        </Space>
      ),
    },
  ];

  // Column definitions for loan offers
  const offerColumns = [
    {
      title: 'Offer ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => (
        <Space size={4}>
          <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{formatAddress(text)}</Text>
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
      title: 'Deposit Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => (
        <Text strong style={{ fontSize: '14px' }}>{formatCurrency(amount, record.asset)}</Text>
      ),
    },
    {
      title: 'Terms',
      key: 'terms',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: 'var(--primary-color)' }}>{record.apr}% APR</Text>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duration: {record.duration} Days</span>
        </Space>
      ),
    },
    {
      title: 'Collateral Rules',
      key: 'collateral',
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ fontSize: '13px' }}>{record.collateralAsset}</Text>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Max LTV: {record.maxLTV}% | Threshold: {record.liquidationThreshold}%
          </div>
        </div>
      ),
    },
    {
      title: 'Offer Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: any) => <OfferStatusBadge status={status} />,
    },
    {
      title: 'Action Ledger',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button size="small" type="text" onClick={() => navigate(`/app/loans/${record.id}`)} style={{ borderRadius: '4px' }}>
            Details
          </Button>
          {record.status === 'Draft' && (
            <Button size="small" type="primary" onClick={() => void fundOffer(record.id)} style={{ borderRadius: '6px', fontSize: '12px' }}>
              Fund
            </Button>
          )}
          {record.status === 'Funding' && (
            <Button size="small" type="primary" onClick={() => void activateOffer(record.id)} style={{ borderRadius: '6px', fontSize: '12px', background: 'var(--success-color)', border: 'none' }}>
              Activate
            </Button>
          )}
          {['Draft', 'Funding', 'Active'].includes(record.status) && (
            <Button size="small" danger ghost onClick={() => void cancelOffer(record.id)} style={{ borderRadius: '6px', fontSize: '12px' }}>
              Cancel
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // Column definitions for repayment activities
  const repaymentColumns = [
    {
      title: 'Tx Hash / Loan ID',
      key: 'loanId',
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{formatAddress(record.loanId || '')}</Text>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {record.txHash ? `${record.txHash.slice(0, 8)}...` : 'Escrow Record'}
          </div>
        </div>
      ),
    },
    {
      title: 'Borrower',
      key: 'borrower',
      render: (_: any, record: any) => {
        const loan = loans.find((item) => item.id === record.loanId);
        return <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatAddress(loan?.borrower ?? record.user)}</Text>;
      },
    },
    {
      title: 'Repayment Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const isFull = type === 'FULL_REPAY';
        return <Tag color={isFull ? 'green' : 'blue'}>{isFull ? 'Full Repay' : 'Partial Repay'}</Tag>;
      },
    },
    {
      title: 'Received Yield & Principal',
      key: 'amount',
      render: (_: any, record: any) => (
        <div>
          <Text strong style={{ color: 'var(--success-color)', fontSize: '14px' }}>+{formatCurrency(record.amount, record.asset)}</Text>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>On-Chain Confirmed</div>
        </div>
      ),
    },
    {
      title: 'Time Received',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {new Date(timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Receipt',
      key: 'receipt',
      render: (_: any, record: any) => record.explorerUrl ? (
        <Button 
          type="link" 
          icon={<ExternalLink size={13} />} 
          href={record.explorerUrl} 
          target="_blank" 
          style={{ padding: 0, height: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
        >
          Verify
        </Button>
      ) : (
        <Text type="secondary" style={{ fontSize: '12px' }}>Settled</Text>
      ),
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
          background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%)', 
          borderRadius: 'var(--radius-xl)', 
          padding: '32px',
          boxShadow: 'var(--shadow-premium)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        {/* Background visual sparkles */}
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-30%', left: '10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(219, 39, 119, 0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Row gutter={[24, 24]} align="middle" justify="space-between">
          <Col xs={24} md={16}>
            <Space direction="vertical" size={4}>
              <span style={{ color: 'var(--secondary-color)', fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Lender Dashboard
              </span>
              <Title level={1} style={{ margin: 0, color: '#ffffff', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '32px', letterSpacing: '-0.03em' }}>
                Lender Portfolio Hub
              </Title>
              <Paragraph style={{ margin: '8px 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '15px', maxWidth: '650px', lineHeight: 1.5 }}>
                Deploy smart contract loan offers, monitor outstanding principal debt, view real-time yield curves, and manage collateral liquidation health zones safely.
              </Paragraph>
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {wallet.connected && (
                <div 
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.06)', 
                    border: '1px solid rgba(255, 255, 255, 0.12)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wallet size={16} style={{ color: 'var(--secondary-color)' }} />
                    <Space direction="vertical" size={0}>
                      <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Lender Account</Text>
                      <Text strong style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{formatAddress(wallet.address)}</Text>
                    </Space>
                  </div>
                  <Divider type="vertical" style={{ height: '24px', borderColor: 'rgba(255, 255, 255, 0.12)' }} />
                  <div>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px', display: 'block', textAlign: 'right' }}>Balance</Text>
                    <Text strong style={{ color: 'var(--success-color)', fontSize: '13px' }}>{formatCurrency(wallet.balanceUSDC, 'USDC')}</Text>
                  </div>
                </div>
              )}
              <Button 
                type="primary" 
                size="large" 
                icon={<Plus size={16} />}
                onClick={() => navigate('/app/create-loan')}
                style={{ 
                  width: '100%', 
                  height: '46px', 
                  borderRadius: 'var(--radius-md)', 
                  fontWeight: 600,
                  fontSize: '15px',
                  background: 'linear-gradient(90deg, var(--primary-color) 0%, #6366f1 100%)',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                Create New Loan Offer
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 2. Visual Analytics Grid */}
      <Row gutter={[24, 24]}>
        
        {/* Chart Card */}
        <Col xs={24} lg={16}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '4px 0' }}>
                <Space size={8}>
                  <TrendingUp size={18} style={{ color: 'var(--primary-color)' }} />
                  <span style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                    Portfolio Yield & Growth Trend
                  </span>
                </Space>
                <Tag color="cyan" style={{ border: 'none', borderRadius: '4px', fontWeight: 600 }}>Soroban Escrow Locked</Tag>
              </div>
            }
            style={{ 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border-color)',
              height: '100%'
            }}
          >
            <div style={{ height: '240px', width: '100%', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockYieldHistory} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorYield" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0.00}/>
                    </linearGradient>
                    <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--secondary-color)" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="var(--secondary-color)" stopOpacity={0.00}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <ChartTooltip 
                    contentStyle={{ 
                      background: 'var(--surface-color)', 
                      borderColor: 'var(--border-color)', 
                      borderRadius: '8px', 
                      boxShadow: 'var(--shadow-md)',
                      fontSize: '12px'
                    }} 
                  />
                  <Area type="monotone" dataKey="Yield" stroke="var(--primary-color)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorYield)" name="Projected Yield ($)" />
                  <Area type="monotone" dataKey="Principal" stroke="var(--secondary-color)" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#colorPrincipal)" name="Active Lent ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
              <Space size={8}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--primary-color)', display: 'inline-block' }} />
                <Text style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Projected Interest Yield ($)</Text>
              </Space>
              <Space size={8}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', border: '1.5px dashed var(--secondary-color)', display: 'inline-block' }} />
                <Text style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active Lent Principal ($)</Text>
              </Space>
            </div>
          </Card>
        </Col>

        {/* Live Yield Simulator Card */}
        <Col xs={24} lg={8}>
          <Card 
            title={
              <Space size={8}>
                <Calculator size={18} style={{ color: 'var(--secondary-color)' }} />
                <span style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                  Interactive Profit Estimator
                </span>
              </Space>
            }
            style={{ 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border-color)',
              background: 'linear-gradient(to bottom, var(--surface-color) 0%, var(--bg-color) 100%)',
              height: '100%'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Principal USDC Amount
                </Text>
                <InputNumber
                  value={calcAmount}
                  onChange={(val) => setCalcAmount(val || 0)}
                  min={10}
                  max={1000000}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
                  style={{ width: '100%', borderRadius: 'var(--radius-sm)' }}
                />
              </div>

              <Row gutter={12}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    APR Rate (%)
                  </Text>
                  <InputNumber
                    value={calcApr}
                    onChange={(val) => setCalcApr(val || 0)}
                    min={1}
                    max={100}
                    addonAfter="%"
                    style={{ width: '100%', borderRadius: 'var(--radius-sm)' }}
                  />
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    Duration (Days)
                  </Text>
                  <InputNumber
                    value={calcDuration}
                    onChange={(val) => setCalcDuration(val || 0)}
                    min={1}
                    max={365}
                    addonAfter="Days"
                    style={{ width: '100%', borderRadius: 'var(--radius-sm)' }}
                  />
                </Col>
              </Row>

              <div 
                style={{ 
                  background: 'rgba(79, 70, 229, 0.03)', 
                  border: '1px dashed rgba(79, 70, 229, 0.2)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '16px',
                  marginTop: '6px'
                }}
              >
                <Row justify="space-between" align="middle" style={{ marginBottom: '8px' }}>
                  <Text style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Expected Yield Return</Text>
                  <Text strong style={{ color: 'var(--primary-color)', fontSize: '18px', fontFamily: 'var(--font-mono)' }}>
                    +{formatCurrency(calculatedYield, 'USDC')}
                  </Text>
                </Row>
                <Row justify="space-between" align="middle">
                  <Text style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Total Repayment Due</Text>
                  <Text strong style={{ color: 'var(--text-main)', fontSize: '15px', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(calculatedTotalRepayment, 'USDC')}
                  </Text>
                </Row>
                
                <Divider style={{ margin: '12px 0' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Percent size={14} style={{ color: 'var(--primary-color)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Yield Ratio: <strong>{((calculatedYield / calcAmount) * 100).toFixed(2)}%</strong> over {calcDuration} days
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </Col>

      </Row>

      {/* 3. Redesigned Stat Cards with custom framer-motion container */}
      <Row gutter={[16, 16]}>
        
        {/* Card 1 */}
        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary-color)' }} styles={{ body: { padding: '16px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Active Lent Principal</Text>
                  <Title level={3} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {formatCurrency(totalLentVal, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary-color)' }}>
                  <Coins size={18} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <Progress percent={totalLentVal > 0 ? 100 : 0} size="small" showInfo={false} strokeColor="var(--primary-color)" style={{ margin: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Active locked in escrow</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 2 */}
        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--secondary-color)' }} styles={{ body: { padding: '16px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Projected Interest Yield</Text>
                  <Title level={3} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {formatCurrency(totalExpectedInterest, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.08)', color: 'var(--secondary-color)' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Avg APR: <strong>{averageApr > 0 ? `${averageApr.toFixed(2)}%` : '0%'}</strong>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Accruing continuously</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 3 */}
        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--success-color)' }} styles={{ body: { padding: '16px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Repayments Received</Text>
                  <Title level={3} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {formatCurrency(totalRepaymentsReceived, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 189, 129, 0.08)', color: 'var(--success-color)' }}>
                  <CheckCircle size={18} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <Progress 
                  percent={totalExpectedInterest > 0 ? Math.min((totalRepaymentsReceived / (totalLentVal + totalExpectedInterest)) * 100, 100) : 0} 
                  size="small" 
                  showInfo={false} 
                  strokeColor="var(--success-color)" 
                  style={{ margin: 0 }} 
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Transferred directly to wallet</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 4 */}
        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--warning-color)' }} styles={{ body: { padding: '16px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Active / Total Offers</Text>
                  <Title level={3} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {activeLoansCount} / {lenderOffers.length}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: 'var(--warning-color)' }}>
                  <FileBadge size={18} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Active positions: <strong>{activeLoansCount} contracts</strong>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Funding status: {fundingOffers.length}</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 5 */}
        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary-color)' }} styles={{ body: { padding: '16px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Funding / Settled</Text>
                  <Title level={3} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {fundingOffers.length} / {completedLoansCount}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary-color)' }}>
                  <Briefcase size={18} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Repaid ledger count: <strong>{completedLoansCount}</strong>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Yield generation ended</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 6 */}
        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--danger-color)' }} styles={{ body: { padding: '16px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Liquidated Loans</Text>
                  <Title level={3} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {liquidatedLoansCount}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger-color)' }}>
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: liquidatedLoansCount > 0 ? 'var(--danger-color)' : 'var(--text-muted)', fontWeight: liquidatedLoansCount > 0 ? 600 : 400 }}>
                  {liquidatedLoansCount > 0 ? 'Collateral claimed' : 'Zero liquidations'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>HF trigger threshold &lt; 1.20</span>
              </div>
            </Card>
          </motion.div>
        </Col>

      </Row>

      {/* 4. Interactive Ledger with Tabs & Filters */}
      <Card 
        styles={{ body: { padding: '24px' } }}
        style={{ 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section Toolbar / Search & Asset Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <Input
                placeholder="Search Contract ID, Borrower address..."
                prefix={<Search size={15} style={{ color: 'var(--text-muted)' }} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', maxWidth: '320px', borderRadius: 'var(--radius-sm)' }}
                allowClear
              />
              
              <Select
                value={selectedAsset}
                onChange={(val) => setSelectedAsset(val)}
                style={{ width: '140px' }}
                options={[
                  { value: 'ALL', label: 'All Collateral' },
                  { value: 'USDC', label: 'USDC Stable' },
                  { value: 'XLM', label: 'Stellar XLM' },
                ]}
              />

              {(searchTerm || selectedAsset !== 'ALL') && (
                <Button 
                  type="text" 
                  size="small" 
                  onClick={() => { setSearchTerm(''); setSelectedAsset('ALL'); }}
                  style={{ fontSize: '12px', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Reset Filters
                </Button>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button 
                type="text" 
                icon={<RefreshCw size={14} />} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}
                onClick={() => {
                  message.success('Soroban ledger data updated');
                }}
              >
                Sync Nodes
              </Button>
            </div>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* Interactive tabs */}
          <Tabs 
            activeKey={activeTab} 
            onChange={(key) => setActiveTab(key)}
            items={[
              {
                key: 'loans',
                label: (
                  <Badge count={filterData(lenderLoans).length} offset={[10, -2]} size="small" color="var(--primary-color)">
                    <span style={{ fontSize: '15px', fontWeight: 600, paddingRight: '8px' }}>Lending Contracts Ledger</span>
                  </Badge>
                ),
                children: (
                  <div style={{ marginTop: '8px' }}>
                    {filterData(lenderLoans).length === 0 ? (
                      <EmptyState
                        title="No active contracts found"
                        description="There are no loan contracts that match your current filters."
                      />
                    ) : (
                      <Table 
                        columns={columns} 
                        dataSource={filterData(lenderLoans).map((item) => ({ ...item, key: item.id }))} 
                        pagination={{ pageSize: 5 }} 
                        style={{ overflowX: 'auto' }}
                      />
                    )}
                  </div>
                )
              },
              {
                key: 'offers',
                label: (
                  <Badge count={filterData(lenderOffers).length} offset={[10, -2]} size="small" color="var(--secondary-color)">
                    <span style={{ fontSize: '15px', fontWeight: 600, paddingRight: '8px' }}>Active Liquidity Offers</span>
                  </Badge>
                ),
                children: (
                  <div style={{ marginTop: '8px' }}>
                    {filterData(lenderOffers).length === 0 ? (
                      <EmptyState
                        title="No liquidity offers found"
                        description="You have not created any drafting or active loan offers matching your query."
                        action={
                          <Button type="primary" onClick={() => navigate('/app/create-loan')} style={{ borderRadius: '6px' }}>
                            Create Loan Offer
                          </Button>
                        }
                      />
                    ) : (
                      <Table 
                        columns={offerColumns} 
                        dataSource={filterData(lenderOffers).map((item) => ({ ...item, key: item.id }))} 
                        pagination={{ pageSize: 5 }} 
                        style={{ overflowX: 'auto' }}
                      />
                    )}
                  </div>
                )
              },
              {
                key: 'repayments',
                label: (
                  <Badge count={repaymentTransactions.length} offset={[10, -2]} size="small" color="var(--success-color)">
                    <span style={{ fontSize: '15px', fontWeight: 600, paddingRight: '8px' }}>Repayments Received</span>
                  </Badge>
                ),
                children: (
                  <div style={{ marginTop: '8px' }}>
                    {repaymentTransactions.length === 0 ? (
                      <EmptyState
                        title="No repayment receipts"
                        description="No payments or yield direct receipts have been recorded in this account yet."
                      />
                    ) : (
                      <Table 
                        columns={repaymentColumns} 
                        dataSource={repaymentTransactions.map((item) => ({ ...item, key: item.id }))} 
                        pagination={{ pageSize: 5 }} 
                        style={{ overflowX: 'auto' }}
                      />
                    )}
                  </div>
                )
              }
            ]}
          />

        </div>
      </Card>
      
      {/* 5. Additional Educational Info or Quick Info */}
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
        <ShieldCheck size={20} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <Text strong style={{ fontSize: '14px', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
            Escrow Backing & isolated contract protection security
          </Text>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Unlike standard pooled lending protocols, Nexus uses isolated escrow contracts on Stellar Soroban. This prevents pool-level systemic risks. 
            Borrowers place collateral directly into dedicated escrow contracts that belong only to your loan. Real-time oracle nodes monitor the 
            liquidation threshold percentage. If a borrower's Health Factor drops below 1.20, liquidators can trigger partial liquidations immediately to protect your principal.
          </span>
        </div>
      </div>

    </motion.div>
  );
};
