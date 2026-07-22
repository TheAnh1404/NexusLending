import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateInterestAmount, formatCurrency, formatAddress, isOpenLoanStatus } from '../utils/finance';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import { OfferStatusBadge } from '../components/common/OfferStatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { EmptyState } from '../components/common/CommonStates';
import { motion } from 'framer-motion';
import {
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Input,
  InputNumber,
  Progress,
  Row,
  Select,
  Slider,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AlertTriangle,
  Briefcase,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileBadge,
  Percent,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { Loan, LoanOffer, Transaction } from '../types';

const { Title, Paragraph, Text } = Typography;

export const LenderDashboardPage: React.FC = () => {
  const { wallet, loans, loanOffers, oraclePrices, activities, fundOffer, activateOffer, cancelOffer, refreshData } = useAppContext();
  const navigate = useNavigate();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('ALL');
  const [activeTab, setActiveTab] = useState('loans');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ type: 'loan' | 'offer' | 'tx'; data: any } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Real-time Oracle Price Shock Stress Test State (-50% to +50%)
  const [oracleShockPct, setOracleShockPct] = useState<number>(0);

  // Profit / Yield Estimator state
  const [calcAmount, setCalcAmount] = useState<number>(5000);
  const [calcApr, setCalcApr] = useState<number>(14);
  const [calcDuration, setCalcDuration] = useState<number>(30);

  // Base XLM Oracle Price from protocol state
  const baseXlmPrice = useMemo(() => {
    const xlmOracle = oraclePrices.find((p) => p.asset === 'XLM');
    return xlmOracle?.price ?? 0.12;
  }, [oraclePrices]);

  const shockedXlmPrice = useMemo(() => {
    return Math.max(0.01, baseXlmPrice * (1 + oracleShockPct / 100));
  }, [baseXlmPrice, oracleShockPct]);

  // Filter lender specific datasets
  const lenderLoans = useMemo(() => {
    return loans.filter((l) => l.lender === wallet.address);
  }, [loans, wallet.address]);

  const lenderLoanIds = useMemo(() => {
    return new Set(lenderLoans.map((loan) => loan.id));
  }, [lenderLoans]);

  const lenderOffers = useMemo(() => {
    return loanOffers.filter((offer) => offer.lender === wallet.address);
  }, [loanOffers, wallet.address]);

  const fundingOffers = useMemo(() => {
    return lenderOffers.filter((offer) => offer.status === 'Funding');
  }, [lenderOffers]);

  const repaymentTransactions = useMemo(() => {
    return activities.filter(
      (tx) =>
        ['PARTIAL_REPAY', 'FULL_REPAY', 'REPAY', 'CLAIM_REPAYMENT'].includes(tx.type) &&
        tx.loanId &&
        lenderLoanIds.has(tx.loanId)
    );
  }, [activities, lenderLoanIds]);

  // Loan status aggregations
  const activeLoans = useMemo(() => lenderLoans.filter((l) => isOpenLoanStatus(l.status)), [lenderLoans]);
  const activeLoansCount = activeLoans.length;

  const liquidatedLoans = useMemo(() => lenderLoans.filter((l) => l.status === 'Liquidated'), [lenderLoans]);
  const liquidatedLoansCount = liquidatedLoans.length;

  // Real-time Stress Test Calculations under simulated Oracle Shock
  const stressTestAnalysis = useMemo(() => {
    let safeCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let claimableCollateralUSD = 0;
    let totalSimulatedCollateralUSD = 0;
    let totalSimulatedDebtUSD = 0;

    const simulatedLoans = activeLoans.map((loan) => {
      const debtUSD = loan.outstandingDebt || loan.amount;
      const collateralValUSD = loan.collateralAmount * shockedXlmPrice;
      const lt = (loan.liquidationThreshold || 80) / 100;
      const simHF = debtUSD > 0 ? (collateralValUSD * lt) / debtUSD : 3.0;

      let zone: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
      if (simHF < 1.18) {
        zone = 'CRITICAL';
        criticalCount++;
        claimableCollateralUSD += collateralValUSD;
      } else if (simHF < 1.45) {
        zone = 'WARNING';
        warningCount++;
      } else {
        safeCount++;
      }
      totalSimulatedCollateralUSD += collateralValUSD;
      totalSimulatedDebtUSD += debtUSD;

      return {
        ...loan,
        simHF,
        simCollateralUSD: collateralValUSD,
        zone,
      };
    });

    const totalCount = activeLoans.length || 1;
    const safePct = Math.round((safeCount / totalCount) * 100);
    const warningPct = Math.round((warningCount / totalCount) * 100);
    const criticalPct = Math.round((criticalCount / totalCount) * 100);
    const recoveryRatioPct = totalSimulatedDebtUSD > 0 ? Math.round((totalSimulatedCollateralUSD / totalSimulatedDebtUSD) * 100) : 100;

    return {
      simulatedLoans,
      safeCount,
      warningCount,
      criticalCount,
      claimableCollateralUSD,
      totalSimulatedCollateralUSD,
      totalSimulatedDebtUSD,
      safePct,
      warningPct,
      criticalPct,
      recoveryRatioPct,
    };
  }, [activeLoans, shockedXlmPrice]);

  // Financial Statistics
  const totalLentVal = useMemo(() => activeLoans.reduce((sum, l) => sum + l.amount, 0), [activeLoans]);

  const totalExpectedInterest = useMemo(() => {
    return activeLoans.reduce((sum, l) => {
      return sum + calculateInterestAmount(l.amount, l.apr, l.duration);
    }, 0);
  }, [activeLoans]);

  const totalRepaymentsReceived = useMemo(() => {
    return repaymentTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [repaymentTransactions]);

  const averageApr = useMemo(() => {
    if (!activeLoans.length) return 0;
    return activeLoans.reduce((sum, l) => sum + l.apr, 0) / activeLoans.length;
  }, [activeLoans]);

  const weightedHealthFactor = useMemo(() => {
    if (!activeLoans.length) return 2.5;
    const sum = activeLoans.reduce((acc, l) => acc + (l.healthFactor || 2.0), 0);
    return sum / activeLoans.length;
  }, [activeLoans]);

  // Copy handler
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    message.success('Copied to clipboard');
  };

  const handleSyncData = async () => {
    setSyncing(true);
    try {
      await refreshData();
      message.success('Soroban ledger state synchronized');
    } finally {
      setSyncing(false);
    }
  };

  // Profit estimator math
  const calculatedYield = (calcAmount * (calcApr / 100) * (calcDuration / 365));
  const calculatedTotalRepayment = calcAmount + calculatedYield;

  // Search & Filter generic helper
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

  const getDaysRemainingText = (dueDateStr: string, status: string) => {
    if (!isOpenLoanStatus(status)) return { text: 'Settled', color: '#64748B' };

    const dueDate = new Date(dueDateStr);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, color: '#EF4444' };
    } else if (diffDays === 0) {
      return { text: 'Due today', color: '#F59E0B' };
    } else if (diffDays <= 3) {
      return { text: `Due in ${diffDays}d`, color: '#F59E0B' };
    }
    return { text: `${diffDays} days remaining`, color: '#10B981' };
  };

  // CSV Export for Lender Portfolio
  const handleExportPortfolioCSV = () => {
    if (!lenderLoans.length && !lenderOffers.length) {
      message.warning('No portfolio data available to export.');
      return;
    }
    const headers = ['Type', 'Contract_ID', 'Borrower_or_Asset', 'Principal_Amount', 'Asset', 'APR', 'Duration_Days', 'HealthFactor', 'Status'];
    const loanRows = lenderLoans.map((l) => [
      'LOAN_CONTRACT',
      l.id,
      l.borrower,
      l.amount,
      l.asset,
      `${l.apr}%`,
      l.duration,
      l.healthFactor?.toFixed(2) || 'N/A',
      l.status,
    ]);
    const offerRows = lenderOffers.map((o) => [
      'LIQUIDITY_OFFER',
      o.id,
      o.collateralAsset,
      o.amount,
      o.asset,
      `${o.apr}%`,
      o.duration,
      'N/A',
      o.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...loanRows.map((e) => e.join(',')), ...offerRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lender_portfolio_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table Columns for Active Loans
  const columns: ColumnsType<Loan> = [
    {
      title: 'Contract / Loan ID',
      dataIndex: 'id',
      key: 'id',
      width: 170,
      render: (text: string) => (
        <Space size={4}>
          <Text strong style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#4F46E5' }}>
            {formatAddress(text)}
          </Text>
          <Tooltip title={copiedId === text ? 'Copied!' : 'Copy Contract ID'}>
            <Button
              type="text"
              size="small"
              icon={copiedId === text ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
              onClick={(e) => {
                e.stopPropagation();
                handleCopyText(text, text);
              }}
              style={{ width: 20, height: 20, padding: 0 }}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Borrower',
      dataIndex: 'borrower',
      key: 'borrower',
      width: 150,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatAddress(text)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Principal Lent',
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      sorter: (a, b) => a.amount - b.amount,
      render: (amount: number, record) => (
        <div>
          <Text strong style={{ fontSize: 14, fontFamily: 'var(--font-heading)', color: '#0F172A' }}>
            {formatCurrency(amount, record.asset)}
          </Text>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            Escrow: {record.collateralAmount} {record.collateralAsset}
          </div>
        </div>
      ),
    },
    {
      title: 'Terms & Yield',
      key: 'terms',
      width: 140,
      render: (_, record) => {
        const estYield = calculateInterestAmount(record.amount, record.apr, record.duration);
        return (
          <Space direction="vertical" size={2}>
            <Tag color="purple" style={{ border: 'none', margin: 0, fontWeight: 700, borderRadius: 6 }}>
              {record.apr}% APR
            </Tag>
            <Text style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>
              +${estYield.toFixed(2)} {record.asset}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Collateral Health',
      dataIndex: 'healthFactor',
      key: 'healthFactor',
      width: 170,
      sorter: (a, b) => (a.healthFactor || 0) - (b.healthFactor || 0),
      render: (hf: number, record) => {
        if (!isOpenLoanStatus(record.status)) return <Text type="secondary">—</Text>;
        let strokeColor = '#10B981';
        if (hf < 1.2) strokeColor = '#EF4444';
        else if (hf < 1.4) strokeColor = '#F59E0B';

        const percentVal = Math.min(((hf || 2.0) / 3) * 100, 100);

        return (
          <div style={{ minWidth: 130 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text strong style={{ fontSize: 13 }}>
                {hf?.toFixed(2) || '2.00'}
              </Text>
              <RiskBadge healthFactor={hf} />
            </div>
            <Progress percent={percentVal} showInfo={false} strokeColor={strokeColor} size="small" style={{ margin: 0 }} />
          </div>
        );
      },
    },
    {
      title: 'Contract Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: any) => <LoanStatusBadge status={status} />,
    },
    {
      title: 'Maturity / Due',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 160,
      render: (date: string, record) => {
        if (!isOpenLoanStatus(record.status)) return <Text type="secondary">—</Text>;
        const daysRemaining = getDaysRemainingText(date, record.status);
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <Calendar size={12} color="#64748B" />
              <span>{new Date(date).toLocaleDateString()}</span>
            </div>
            <span style={{ fontSize: 11, color: daysRemaining.color, fontWeight: 700 }}>
              {daysRemaining.text}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Action',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItem({ type: 'loan', data: record });
          }}
          style={{ borderRadius: 6, fontWeight: 600 }}
        >
          Inspect
        </Button>
      ),
    },
  ];

  // Offer Columns
  const offerColumns: ColumnsType<LoanOffer> = [
    {
      title: 'Offer ID',
      dataIndex: 'id',
      key: 'id',
      width: 170,
      render: (text: string) => (
        <Space size={4}>
          <Text strong style={{ fontFamily: 'var(--font-mono)', color: '#4F46E5' }}>
            {formatAddress(text)}
          </Text>
          <Tooltip title={copiedId === text ? 'Copied!' : 'Copy Offer ID'}>
            <Button
              type="text"
              size="small"
              icon={copiedId === text ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
              onClick={(e) => {
                e.stopPropagation();
                handleCopyText(text, text);
              }}
              style={{ width: 20, height: 20, padding: 0 }}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Deposit Capital',
      dataIndex: 'amount',
      key: 'amount',
      width: 160,
      render: (amount: number, record) => (
        <Text strong style={{ fontSize: 14, fontFamily: 'var(--font-heading)', color: '#0F172A' }}>
          {formatCurrency(amount, record.asset)}
        </Text>
      ),
    },
    {
      title: 'Fixed Terms',
      key: 'terms',
      width: 160,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: '#4F46E5' }}>
            {record.apr}% APR
          </Text>
          <span style={{ fontSize: 11, color: '#64748B' }}>Duration: {record.duration} Days</span>
        </Space>
      ),
    },
    {
      title: 'Collateral Rules',
      key: 'collateral',
      width: 180,
      render: (_, record) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {record.collateralAsset}
          </Text>
          <div style={{ fontSize: 11, color: '#64748B' }}>
            Max LTV: {record.maxLTV}% | Threshold: {record.liquidationThreshold}%
          </div>
        </div>
      ),
    },
    {
      title: 'Escrow Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: any) => <OfferStatusBadge status={status} />,
    },
    {
      title: 'Smart Action',
      key: 'actions',
      width: 210,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'Draft' && (
            <Button size="small" type="primary" onClick={() => void fundOffer(record.id)} style={{ borderRadius: 6, fontSize: 12 }}>
              Fund Escrow
            </Button>
          )}
          {record.status === 'Funding' && (
            <Button
              size="small"
              type="primary"
              onClick={() => void activateOffer(record.id)}
              style={{ borderRadius: 6, fontSize: 12, background: '#10B981', border: 'none' }}
            >
              Activate Market
            </Button>
          )}
          {['Draft', 'Funding', 'Active'].includes(record.status || 'Draft') && (
            <Button size="small" danger ghost onClick={() => void cancelOffer(record.id)} style={{ borderRadius: 6, fontSize: 12 }}>
              Cancel
            </Button>
          )}
          <Button
            size="small"
            type="text"
            icon={<Eye size={12} />}
            onClick={() => setSelectedItem({ type: 'offer', data: record })}
          />
        </Space>
      ),
    },
  ];

  // Repayment Columns
  const repaymentColumns: ColumnsType<Transaction> = [
    {
      title: 'Tx Receipt / Loan ID',
      key: 'loanId',
      width: 180,
      render: (_, record) => (
        <div>
          <Text strong style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {formatAddress(record.loanId || '')}
          </Text>
          <div style={{ fontSize: 11, color: '#64748B', fontFamily: 'var(--font-mono)' }}>
            {record.txHash ? formatAddress(record.txHash) : 'Escrow Direct'}
          </div>
        </div>
      ),
    },
    {
      title: 'Borrower',
      key: 'borrower',
      width: 160,
      render: (_, record) => {
        const loan = loans.find((item) => item.id === record.loanId);
        return <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatAddress(loan?.borrower ?? record.user)}</Text>;
      },
    },
    {
      title: 'Repayment Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type: string) => {
        const isFull = type === 'FULL_REPAY';
        return <Tag color={isFull ? 'green' : 'blue'}>{isFull ? 'Full Repay' : 'Partial Repay'}</Tag>;
      },
    },
    {
      title: 'Cashflow Received',
      key: 'amount',
      width: 160,
      render: (_, record) => (
        <div>
          <Text strong style={{ color: '#10B981', fontSize: 14, fontFamily: 'var(--font-heading)' }}>
            +{formatCurrency(record.amount, record.asset)}
          </Text>
          <div style={{ fontSize: 11, color: '#64748B' }}>On-Chain Confirmed</div>
        </div>
      ),
    },
    {
      title: 'Settlement Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => (
        <span style={{ fontSize: 12, color: '#64748B' }}>
          {new Date(timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Receipt Proof',
      key: 'receipt',
      width: 120,
      render: (_, record) =>
        record.explorerUrl ? (
          <a
            href={record.explorerUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4F46E5', fontWeight: 600 }}
          >
            Verify <ExternalLink size={11} />
          </a>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Settled</Text>
        ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}
    >
      {/* 1. Header Banner & Executive Control */}
      <Card
        styles={{ body: { padding: '28px 32px' } }}
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #1E293B 100%)',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.5)',
          color: '#FFFFFF',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: '-20%', right: '-5%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79, 70, 229, 0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Row gutter={[24, 24]} align="middle" justify="space-between">
          <Col xs={24} md={15}>
            <Space direction="vertical" size={6}>
              <Space size={10} align="center">
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
                    color: '#FFFFFF',
                  }}
                >
                  <Briefcase size={18} />
                </span>
                <Title level={1} style={{ margin: 0, color: '#FFFFFF', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30 }}>
                  Lender Portfolio & Risk Engine
                </Title>
                <Tag
                  color="cyan"
                  style={{
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    borderColor: 'rgba(6, 182, 212, 0.4)',
                    color: '#38BDF8',
                    borderRadius: 20,
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  SOROBAN ORACLE INDEXED
                </Tag>
              </Space>
              <Paragraph style={{ margin: 0, color: '#94A3B8', fontSize: 14, maxWidth: 640 }}>
                Manage liquidity deployments, test collateral risk exposure under Oracle price shocks, and audit isolated Soroban contract health zones.
              </Paragraph>
            </Space>
          </Col>

          <Col xs={24} md={9} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {wallet.connected && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wallet size={16} color="#38BDF8" />
                    <Space direction="vertical" size={0}>
                      <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>
                        Lender Account
                      </Text>
                      <Text strong style={{ color: '#FFFFFF', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                        {formatAddress(wallet.address)}
                      </Text>
                    </Space>
                  </div>
                  <Divider type="vertical" style={{ height: 24, borderColor: 'rgba(255, 255, 255, 0.15)' }} />
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 10, display: 'block' }}>Liquidity</Text>
                    <Text strong style={{ color: '#34D399', fontSize: 13 }}>
                      {formatCurrency(wallet.balanceUSDC, 'USDC')}
                    </Text>
                  </div>
                </div>
              )}

              <Space size={10} style={{ width: '100%' }}>
                <Button
                  icon={<Download size={14} />}
                  onClick={handleExportPortfolioCSV}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#FFFFFF',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    fontWeight: 600,
                  }}
                >
                  Export CSV
                </Button>
                <Button
                  type="primary"
                  icon={<Plus size={16} />}
                  onClick={() => navigate('/app/create-loan')}
                  style={{
                    flex: 1.5,
                    height: 44,
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: 14,
                    background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                  }}
                >
                  Create Offer
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 2. REAL INSTITUTIONAL FEATURE: Live Oracle Stress-Tester & Liquidation Risk Matrix */}
      <Row gutter={[20, 20]}>
        {/* Left Column: Interactive Oracle Stress Simulator */}
        <Col xs={24} lg={15}>
          <Card
            className="card-premium"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '4px 0' }}>
                <Space size={8}>
                  <ShieldAlert size={18} color="#4F46E5" />
                  <span style={{ fontSize: 16, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                    Oracle Price Shock & Liquidation Stress-Tester
                  </span>
                </Space>
                <Tag color={oracleShockPct < 0 ? 'red' : oracleShockPct > 0 ? 'green' : 'blue'} style={{ border: 'none', borderRadius: 4, fontWeight: 700 }}>
                  XLM Oracle: ${baseXlmPrice.toFixed(4)} ➔ ${shockedXlmPrice.toFixed(4)} ({oracleShockPct > 0 ? '+' : ''}{oracleShockPct}%)
                </Tag>
              </div>
            }
            style={{ height: '100%' }}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Paragraph style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                Simulate instant market crashes or pumps to test portfolio collateralization. See how many borrower contracts enter the <strong>Liquidation Zone</strong> and measure net capital recovery.
              </Paragraph>

              {/* Slider & Quick Shock Controls */}
              <div style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 12, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em' }}>
                    Simulated XLM Price Shock (%)
                  </Text>
                  <Space size={6}>
                    {[-30, -15, 0, 15, 30].map((preset) => (
                      <Button
                        key={preset}
                        size="small"
                        type={oracleShockPct === preset ? 'primary' : 'default'}
                        onClick={() => setOracleShockPct(preset)}
                        style={{ borderRadius: 6, fontSize: 11, fontWeight: 700 }}
                      >
                        {preset > 0 ? `+${preset}%` : `${preset}%`}
                      </Button>
                    ))}
                  </Space>
                </div>

                <Slider
                  min={-50}
                  max={50}
                  step={1}
                  value={oracleShockPct}
                  onChange={(val) => setOracleShockPct(val)}
                  marks={{
                    '-50': '-50% Crash',
                    '-25': '-25%',
                    '0': 'Current Price',
                    '25': '+25%',
                    '50': '+50% Rally',
                  }}
                />
              </div>

              {/* Portfolio Risk Distribution Stacked Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <Text strong style={{ color: '#0F172A' }}>Portfolio Health Distribution under Shock:</Text>
                  <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#64748B' }}>
                    Recovery Coverage: <strong style={{ color: stressTestAnalysis.recoveryRatioPct >= 100 ? '#10B981' : '#EF4444' }}>{stressTestAnalysis.recoveryRatioPct}%</strong>
                  </Text>
                </div>

                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#E2E8F0' }}>
                  <div style={{ width: `${stressTestAnalysis.safePct}%`, backgroundColor: '#10B981', transition: 'width 0.3s ease' }} title={`Safe: ${stressTestAnalysis.safePct}%`} />
                  <div style={{ width: `${stressTestAnalysis.warningPct}%`, backgroundColor: '#F59E0B', transition: 'width 0.3s ease' }} title={`Warning: ${stressTestAnalysis.warningPct}%`} />
                  <div style={{ width: `${stressTestAnalysis.criticalPct}%`, backgroundColor: '#EF4444', transition: 'width 0.3s ease' }} title={`Critical: ${stressTestAnalysis.criticalPct}%`} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                  <Space size={6}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
                    <Text style={{ color: '#475569' }}>Safe (HF ≥ 1.45): <strong>{stressTestAnalysis.safeCount}</strong></Text>
                  </Space>
                  <Space size={6}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B', display: 'inline-block' }} />
                    <Text style={{ color: '#475569' }}>Warning (1.18 ≤ HF &lt; 1.45): <strong>{stressTestAnalysis.warningCount}</strong></Text>
                  </Space>
                  <Space size={6}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EF4444', display: 'inline-block' }} />
                    <Text style={{ color: '#EF4444', fontWeight: 700 }}>Critical (HF &lt; 1.18): <strong>{stressTestAnalysis.criticalCount}</strong></Text>
                  </Space>
                </div>
              </div>

              {/* Stress Simulation Impact Summary */}
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <div style={{ padding: 12, borderRadius: 10, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>
                      Claimable Collateral Value
                    </Text>
                    <Title level={4} style={{ margin: '2px 0 0 0', color: stressTestAnalysis.criticalCount > 0 ? '#EF4444' : '#0F172A', fontFamily: 'var(--font-heading)' }}>
                      ${stressTestAnalysis.claimableCollateralUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {stressTestAnalysis.criticalCount > 0 ? 'Collateral available for immediate liquidation' : 'Zero loans in liquidation threshold'}
                    </Text>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: 12, borderRadius: 10, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>
                      Simulated Collateral Value
                    </Text>
                    <Title level={4} style={{ margin: '2px 0 0 0', color: '#4F46E5', fontFamily: 'var(--font-heading)' }}>
                      ${stressTestAnalysis.totalSimulatedCollateralUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Backing ${totalLentVal.toLocaleString()} USDC active principal
                    </Text>
                  </div>
                </Col>
              </Row>
            </Space>
          </Card>
        </Col>

        {/* Right Column: Profit Estimator */}
        <Col xs={24} lg={9}>
          <Card
            className="card-premium"
            title={
              <Space size={8}>
                <Calculator size={18} color="#06B6D4" />
                <span style={{ fontSize: 16, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
                  Interactive Profit Estimator
                </span>
              </Space>
            }
            style={{ height: '100%', background: 'linear-gradient(to bottom, #FFFFFF 0%, #F8FAFC 100%)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Principal USDC Capital
                </Text>
                <InputNumber
                  value={calcAmount}
                  onChange={(val) => setCalcAmount(val || 0)}
                  min={100}
                  max={1000000}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </div>

              <Row gutter={12}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Fixed APR Rate (%)
                  </Text>
                  <InputNumber
                    value={calcApr}
                    onChange={(val) => setCalcApr(val || 0)}
                    min={1}
                    max={100}
                    addonAfter="%"
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                    Duration (Days)
                  </Text>
                  <InputNumber
                    value={calcDuration}
                    onChange={(val) => setCalcDuration(val || 0)}
                    min={1}
                    max={365}
                    addonAfter="Days"
                    style={{ width: '100%', borderRadius: 8 }}
                  />
                </Col>
              </Row>

              <div
                style={{
                  background: 'rgba(79, 70, 229, 0.03)',
                  border: '1px dashed rgba(79, 70, 229, 0.25)',
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: '#64748B', fontSize: 13 }}>Expected Net Return</Text>
                  <Text strong style={{ color: '#4F46E5', fontSize: 18, fontFamily: 'var(--font-mono)' }}>
                    +{formatCurrency(calculatedYield, 'USDC')}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', fontSize: 13 }}>Total Repayment Due</Text>
                  <Text strong style={{ color: '#0F172A', fontSize: 15, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(calculatedTotalRepayment, 'USDC')}
                  </Text>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Percent size={14} color="#4F46E5" />
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    Net Return Ratio: <strong>{((calculatedYield / calcAmount) * 100).toFixed(2)}%</strong> over {calcDuration} days
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 3. 6-Card Executive Key Metrics Suite */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 12, borderLeft: '4px solid #4F46E5' }} styles={{ body: { padding: 16 } }} className="card-premium">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Active Lent
                  </Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#0F172A' }}>
                    {formatCurrency(totalLentVal, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(79, 70, 229, 0.08)', color: '#4F46E5' }}>
                  <Coins size={18} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <Progress percent={totalLentVal > 0 ? 100 : 0} size="small" showInfo={false} strokeColor="#4F46E5" style={{ margin: 0 }} />
                <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 4 }}>Locked in Soroban Escrow</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 12, borderLeft: '4px solid #06B6D4' }} styles={{ body: { padding: 16 } }} className="card-premium">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Expected Yield
                  </Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#0F172A' }}>
                    {formatCurrency(totalExpectedInterest, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(6, 182, 212, 0.08)', color: '#06B6D4' }}>
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  Avg APR: <strong>{averageApr > 0 ? `${averageApr.toFixed(2)}%` : '0%'}</strong>
                </span>
                <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 4 }}>Accruing per block</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 12, borderLeft: '4px solid #10B981' }} styles={{ body: { padding: 16 } }} className="card-premium">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Repayments Recv
                  </Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#0F172A' }}>
                    {formatCurrency(totalRepaymentsReceived, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(16, 185, 129, 0.08)', color: '#10B981' }}>
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={totalExpectedInterest > 0 ? Math.min((totalRepaymentsReceived / (totalLentVal + totalExpectedInterest)) * 100, 100) : 0}
                  size="small"
                  showInfo={false}
                  strokeColor="#10B981"
                  style={{ margin: 0 }}
                />
                <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 4 }}>Transferred to wallet</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 12, borderLeft: '4px solid #F59E0B' }} styles={{ body: { padding: 16 } }} className="card-premium">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Active / Total Offers
                  </Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#0F172A' }}>
                    {activeLoansCount} / {lenderOffers.length}
                  </Title>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245, 158, 11, 0.08)', color: '#F59E0B' }}>
                  <FileBadge size={18} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  Active positions: <strong>{activeLoansCount}</strong>
                </span>
                <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 4 }}>Funding offers: {fundingOffers.length}</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 12, borderLeft: '4px solid #8B5CF6' }} styles={{ body: { padding: 16 } }} className="card-premium">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Avg Health Index
                  </Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#0F172A' }}>
                    {weightedHealthFactor.toFixed(2)}
                  </Title>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(139, 92, 246, 0.08)', color: '#8B5CF6' }}>
                  <ShieldCheck size={18} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#10B981', fontWeight: 700 }}>
                  Safety zone &gt; 1.50
                </span>
                <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 4 }}>Collateral protection</span>
              </div>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} lg={4}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 12, borderLeft: '4px solid #EF4444' }} styles={{ body: { padding: 16 } }} className="card-premium">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                    Liquidated Loans
                  </Text>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, color: liquidatedLoansCount > 0 ? '#EF4444' : '#0F172A' }}>
                    {liquidatedLoansCount}
                  </Title>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: 'rgba(239, 68, 68, 0.08)', color: '#EF4444' }}>
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, color: liquidatedLoansCount > 0 ? '#EF4444' : '#64748B', fontWeight: liquidatedLoansCount > 0 ? 700 : 400 }}>
                  {liquidatedLoansCount > 0 ? 'Collateral claimed' : 'Zero liquidations'}
                </span>
                <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 4 }}>HF trigger threshold &lt; 1.20</span>
              </div>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* 4. Interactive Ledger with Tabs & Smart Toolbar */}
      <Card styles={{ body: { padding: 24 } }} className="card-premium">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Search Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <Space size={12} wrap style={{ flex: 1 }}>
              <Input
                placeholder="Search Contract ID, Borrower address..."
                prefix={<Search size={15} color="#94A3B8" />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: 320, borderRadius: 8 }}
                allowClear
              />

              <Select
                value={selectedAsset}
                onChange={(val) => setSelectedAsset(val)}
                style={{ width: 150 }}
                options={[
                  { value: 'ALL', label: 'All Assets' },
                  { value: 'USDC', label: 'USDC Lending' },
                  { value: 'XLM', label: 'Stellar XLM' },
                ]}
              />

              {(searchTerm || selectedAsset !== 'ALL') && (
                <Button
                  type="text"
                  size="small"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedAsset('ALL');
                  }}
                  style={{ fontSize: 12, color: '#4F46E5', fontWeight: 600 }}
                >
                  Reset Filters
                </Button>
              )}
            </Space>

            <Button
              type="default"
              icon={<RefreshCw size={14} className={syncing ? 'spin' : ''} />}
              loading={syncing}
              onClick={handleSyncData}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Sync Soroban Ledger
            </Button>
          </div>

          <Divider style={{ margin: 0 }} />

          {/* Tabs Navigation */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            items={[
              {
                key: 'loans',
                label: (
                  <Badge count={filterData(lenderLoans).length} offset={[10, -2]} size="small" color="#4F46E5">
                    <span style={{ fontSize: 15, fontWeight: 700, paddingRight: 8 }}>Lending Contracts Ledger</span>
                  </Badge>
                ),
                children: (
                  <div style={{ marginTop: 12 }}>
                    {filterData(lenderLoans).length === 0 ? (
                      <EmptyState
                        title="No active lending contracts found"
                        description="There are no loan contracts that match your current search and asset filters."
                      />
                    ) : (
                      <Table
                        columns={columns}
                        dataSource={filterData(lenderLoans).map((item) => ({ ...item, key: item.id }))}
                        onRow={(record) => ({
                          onClick: () => setSelectedItem({ type: 'loan', data: record }),
                          style: { cursor: 'pointer' },
                        })}
                        pagination={{ pageSize: 6, showSizeChanger: true }}
                        scroll={{ x: 1100 }}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'offers',
                label: (
                  <Badge count={filterData(lenderOffers).length} offset={[10, -2]} size="small" color="#06B6D4">
                    <span style={{ fontSize: 15, fontWeight: 700, paddingRight: 8 }}>Active Liquidity Offers</span>
                  </Badge>
                ),
                children: (
                  <div style={{ marginTop: 12 }}>
                    {filterData(lenderOffers).length === 0 ? (
                      <EmptyState
                        title="No liquidity offers found"
                        description="You have not created any drafting or active loan offers matching your query."
                        action={
                          <Button type="primary" onClick={() => navigate('/app/create-loan')} style={{ borderRadius: 8 }}>
                            Create Loan Offer
                          </Button>
                        }
                      />
                    ) : (
                      <Table
                        columns={offerColumns}
                        dataSource={filterData(lenderOffers).map((item) => ({ ...item, key: item.id }))}
                        onRow={(record) => ({
                          onClick: () => setSelectedItem({ type: 'offer', data: record }),
                          style: { cursor: 'pointer' },
                        })}
                        pagination={{ pageSize: 6, showSizeChanger: true }}
                        scroll={{ x: 1100 }}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'repayments',
                label: (
                  <Badge count={repaymentTransactions.length} offset={[10, -2]} size="small" color="#10B981">
                    <span style={{ fontSize: 15, fontWeight: 700, paddingRight: 8 }}>Repayments Received</span>
                  </Badge>
                ),
                children: (
                  <div style={{ marginTop: 12 }}>
                    {repaymentTransactions.length === 0 ? (
                      <EmptyState
                        title="No repayment receipts recorded"
                        description="No payments or yield direct receipts have been recorded in this account yet."
                      />
                    ) : (
                      <Table
                        columns={repaymentColumns}
                        dataSource={repaymentTransactions.map((item) => ({ ...item, key: item.id }))}
                        pagination={{ pageSize: 6, showSizeChanger: true }}
                        scroll={{ x: 1000 }}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Card>

      {/* 5. Institutional Security & Escrow Notice */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.04) 0%, rgba(6, 182, 212, 0.04) 100%)',
          border: '1px solid rgba(79, 70, 229, 0.15)',
          borderRadius: 16,
          padding: '20px 24px',
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        <ShieldCheck size={22} color="#4F46E5" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <Text strong style={{ fontSize: 15, color: '#0F172A', display: 'block', marginBottom: 4, fontFamily: 'var(--font-heading)' }}>
            Isolated Soroban Escrow & Collateral Liquidation Guarantee
          </Text>
          <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
            Unlike standard pooled lending protocols, Nexus deploys isolated smart contract escrows on Stellar Soroban. Borrower collateral is locked directly inside dedicated smart contract vaults for your specific loan. Real-time oracle nodes constantly calculate the Health Factor. If a borrower's Health Factor drops below 1.20, liquidators can trigger automated collateral liquidations to protect your principal capital.
          </span>
        </div>
      </div>

      {/* 6. Inspection Drawer */}
      <Drawer
        title={
          <Space align="center" size={10}>
            <Terminal size={18} color="#4F46E5" />
            <Text strong style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>
              Lender Contract Audit Inspector
            </Text>
          </Space>
        }
        placement="right"
        width={520}
        onClose={() => setSelectedItem(null)}
        open={!!selectedItem}
        styles={{ body: { padding: 24 } }}
      >
        {selectedItem && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                backgroundColor: 'rgba(79, 70, 229, 0.06)',
                border: '1px solid rgba(79, 70, 229, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text strong style={{ fontSize: 16, color: '#4F46E5' }}>
                {selectedItem.type.toUpperCase()} INSPECTOR
              </Text>
              <Tag color="blue">{selectedItem.data.status || 'Active'}</Tag>
            </div>

            <Card styles={{ body: { padding: 16 } }} style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    Capital Amount
                  </Text>
                  <Title level={4} style={{ margin: 0, color: '#0F172A' }}>
                    {formatCurrency(selectedItem.data.amount, selectedItem.data.asset || 'USDC')}
                  </Title>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    Fixed APR Rate
                  </Text>
                  <Title level={4} style={{ margin: 0, color: '#4F46E5' }}>
                    {selectedItem.data.apr}%
                  </Title>
                </Col>
              </Row>
            </Card>

            <div>
              <Title level={5} style={{ fontSize: 13, textTransform: 'uppercase', color: '#64748B' }}>
                Contract Identifiers
              </Title>
              <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text type="secondary">ID / Hash:</Text>
                  <Text style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selectedItem.data.id}</Text>
                </div>
                {selectedItem.data.borrower && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <Text type="secondary">Borrower Account:</Text>
                    <Text style={{ fontFamily: 'var(--font-mono)' }}>{formatAddress(selectedItem.data.borrower)}</Text>
                  </div>
                )}
                {selectedItem.data.collateralAmount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <Text type="secondary">Escrow Collateral:</Text>
                    <Text style={{ fontWeight: 600 }}>
                      {selectedItem.data.collateralAmount} {selectedItem.data.collateralAsset}
                    </Text>
                  </div>
                )}
              </Space>
            </div>

            <div>
              <Title level={5} style={{ fontSize: 13, textTransform: 'uppercase', color: '#64748B' }}>
                Raw Data Payload
              </Title>
              <pre
                style={{
                  backgroundColor: '#0F172A',
                  color: '#38BDF8',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  overflowX: 'auto',
                  maxHeight: 200,
                }}
              >
                {JSON.stringify(selectedItem.data, null, 2)}
              </pre>
            </div>

            <Button
              type="primary"
              block
              onClick={() => {
                const id = selectedItem.data.id;
                setSelectedItem(null);
                navigate(`/app/loans/${id}`);
              }}
            >
              Open Full Contract Page
            </Button>
          </Space>
        )}
      </Drawer>
    </motion.div>
  );
};
