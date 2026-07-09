import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import type { OracleImpact } from '../contexts/LendingContext';
import { ADMIN_WALLET_ADDRESS, isAdminWallet } from '../config/admin';
import {
  calculateHealthFactor,
  formatAddress,
  formatCurrency,
  getRiskZone,
  isLiquidatable,
  isOpenLoanStatus,
} from '../utils/finance';
import { CONTRACTS, HORIZON_URL, NETWORK, RPC_URL } from '../services/soroban/config';
import { CHAIN_MODE, DATA_MODE } from '../services/api/client';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import { OfferStatusBadge } from '../components/common/OfferStatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import {
  App as AntdApp,
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  InputNumber,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Tabs,
  Slider,
  Progress,
  Badge,
  Switch,
} from 'antd';
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  Flame,
  LineChart,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Wallet,
  Coins,
  TrendingDown,
  TrendingUp,
  Sliders,
  Play,
  Settings,
  Database,
  Info,
  Copy,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart as ReLineChart,
  Line,
} from 'recharts';

const { Title, Text, Paragraph } = Typography;

const formatTxType = (type: string): string => type.replace(/_/g, ' ');

const formatDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const AdminPage: React.FC = () => {
  const {
    wallet,
    loanOffers,
    loans,
    oraclePrices,
    transactions,
    updateOraclePrice,
    recalculateAllHealthFactors,
    connectWallet,
  } = useAppContext();

  const { message, modal } = AntdApp.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const xlmPriceInfo = oraclePrices.find((price) => price.asset === 'XLM');
  const xlmPrice = xlmPriceInfo?.price ?? 0.125;
  const usdcPrice = oraclePrices.find((price) => price.asset === 'USDC')?.price ?? 1;

  // State Management
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [newPrice, setNewPrice] = useState<number>(xlmPrice);
  const [lastImpacts, setLastImpacts] = useState<OracleImpact[]>([]);
  const [updatingOracle, setUpdatingOracle] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Market Shock simulation state
  const [simulatedDropPercent, setSimulatedDropPercent] = useState<number>(0);
  
  // Dev mode and Emergency Controls
  const [devModeActive, setDevModeActive] = useState<boolean>(false);
  const [emergencyWithdrawActive, setEmergencyWithdrawActive] = useState<boolean>(false);

  // Authorize wallet logic
  const isCurrentWalletAdmin = isAdminWallet(wallet.address);

  // Quick action: Connect Admin Wallet Demo
  const handleConnectAdminDemo = () => {
    connectWallet(ADMIN_WALLET_ADDRESS);
    message.success('Connected admin wallet for demonstration!');
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`Copied ${label} to clipboard!`);
  };

  // Process data from Context
  const openLoans = useMemo(() => loans.filter((loan) => isOpenLoanStatus(loan.status)), [loans]);
  const activeLoans = useMemo(
    () => openLoans.filter((loan) => loan.status !== 'PendingCollateral'),
    [openLoans]
  );
  
  const activeOffers = useMemo(
    () => loanOffers.filter((offer) => offer.status === 'Active'),
    [loanOffers]
  );
  
  const fundedOffers = useMemo(
    () => loanOffers.filter((offer) => ['Funding', 'Active'].includes(offer.status ?? 'Draft')),
    [loanOffers]
  );

  // Financial Metrics
  const totalBorrowed = useMemo(() => activeLoans.reduce((sum, loan) => sum + loan.outstandingDebt, 0), [activeLoans]);
  const collateralXlm = useMemo(() => activeLoans.reduce((sum, loan) => sum + loan.collateralAmount, 0), [activeLoans]);
  const collateralValue = collateralXlm * xlmPrice;
  const availableLiquidity = useMemo(() => fundedOffers.reduce((sum, offer) => sum + offer.amount, 0), [fundedOffers]);
  const tvl = collateralValue + availableLiquidity;
  const avgHealthFactor = useMemo(() => activeLoans.length
    ? activeLoans.reduce((sum, loan) => sum + loan.healthFactor, 0) / activeLoans.length
    : 0, [activeLoans]);

  const warningLoans = useMemo(() => openLoans.filter(
    (loan) => loan.status === 'Warning' || loan.status === 'LiquidationPlanning' || loan.status === 'Defaulted' || loan.healthFactor < 1.4
  ), [openLoans]);

  const liquidatableLoans = useMemo(() => openLoans.filter((loan) => isLiquidatable(loan.healthFactor, loan.status)), [openLoans]);
  const latestOracleTx = useMemo(() => transactions.find((tx) => tx.type === 'UPDATE_ORACLE'), [transactions]);

  // Simulated results of Price Shock Slider
  const simulatedPrice = xlmPrice * (1 + simulatedDropPercent / 100);
  
  const shockSimulationStats = useMemo(() => {
    let safe = 0;
    let warning = 0;
    let danger = 0;
    let liquidatable = 0;
    let totalDebtAtRisk = 0;

    activeLoans.forEach((loan) => {
      const simulatedHF = calculateHealthFactor(
        loan.collateralAmount,
        simulatedPrice,
        loan.outstandingDebt,
        usdcPrice,
        loan.liquidationThreshold
      );

      const simStatus = simulatedHF < 1.0 ? 'Liquidatable' : simulatedHF < 1.2 ? 'Danger' : simulatedHF < 1.4 ? 'Warning' : 'Safe';
      
      if (simStatus === 'Liquidatable') {
        liquidatable++;
        totalDebtAtRisk += loan.outstandingDebt;
      } else if (simStatus === 'Danger') {
        danger++;
        totalDebtAtRisk += loan.outstandingDebt;
      } else if (simStatus === 'Warning') {
        warning++;
      } else {
        safe++;
      }
    });

    return { safe, warning, danger, liquidatable, totalDebtAtRisk };
  }, [activeLoans, simulatedPrice, usdcPrice]);

  // Chart Data Generator: TVL & Borrow History Trend (Simulated based on actual system inputs)
  const chartData = useMemo(() => {
    const data = [];
    const baseTvl = tvl > 0 ? tvl : 85000;
    const baseDebt = totalBorrowed > 0 ? totalBorrowed : 32000;
    const baseLiquidity = availableLiquidity > 0 ? availableLiquidity : 53000;
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const factor = 1 + Math.sin(i * 1.2) * 0.04;
      data.push({
        name: dayStr,
        'Total TVL ($)': Math.round(baseTvl * factor),
        'Total Debt ($)': Math.round(baseDebt * (1 + Math.cos(i) * 0.02)),
        'Available Liquidity ($)': Math.round(baseLiquidity * (1 - Math.sin(i * 0.5) * 0.03)),
      });
    }
    return data;
  }, [tvl, totalBorrowed, availableLiquidity]);

  // Chart Data: Price History vs System Health Factor
  const priceVsHealthChartData = useMemo(() => {
    const data = [];
    const basePrice = xlmPrice;
    const baseHealth = avgHealthFactor > 0 ? avgHealthFactor : 1.85;
    for (let i = 9; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const priceDelta = Math.sin(i * 0.7) * 0.006 - (i * 0.002);
      const simulatedPricePoint = basePrice + priceDelta;
      const simulatedHealthPoint = Math.max(1.1, baseHealth * (simulatedPricePoint / basePrice));

      data.push({
        name: dayStr,
        'XLM Price ($)': parseFloat(simulatedPricePoint.toFixed(4)),
        'System Health (Avg HF)': parseFloat(simulatedHealthPoint.toFixed(2)),
      });
    }
    return data;
  }, [xlmPrice, avgHealthFactor]);

  // Chart Data: Risk Distribution (Safe vs Warning vs Danger)
  const riskDistributionData = useMemo(() => {
    let safeCount = 0;
    let warningCount = 0;
    let dangerCount = 0;

    activeLoans.forEach((loan) => {
      if (loan.healthFactor >= 1.4) safeCount++;
      else if (loan.healthFactor >= 1.2) warningCount++;
      else dangerCount++;
    });

    return [
      { name: 'Safe (HF ≥ 1.4)', value: safeCount, color: '#10B981' },
      { name: 'Warning (1.2 ≤ HF < 1.4)', value: warningCount, color: '#F59E0B' },
      { name: 'Critical (HF < 1.2)', value: dangerCount, color: '#EF4444' },
    ].filter(item => item.value > 0);
  }, [activeLoans]);

  // Handle manual oracle price updates
  const handleUpdateOracle = async () => {
    try {
      setUpdatingOracle(true);
      const impacts = await updateOraclePrice(newPrice);
      setLastImpacts(impacts);
      message.success(`Oracle price updated successfully on-chain!`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update Oracle price.');
    } finally {
      setUpdatingOracle(false);
    }
  };

  // Handle recalculation request
  const handleRecalculate = async () => {
    try {
      setRecalculating(true);
      const impacts = await recalculateAllHealthFactors();
      setLastImpacts(impacts);
      message.success(`Recalculated health factors for all ${loans.length} loans.`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to recalculate health factors.');
    } finally {
      setRecalculating(false);
    }
  };

  // Trigger simulated emergency withdraw
  const handleEmergencyWithdrawToggle = (checked: boolean) => {
    if (!isCurrentWalletAdmin) {
      message.error('Emergency Withdraw operations are restricted to the authorized admin wallet.');
      return;
    }
    
    modal.confirm({
      title: checked ? 'Activate Protocol Emergency Pause?' : 'Deactivate Emergency Pause?',
      icon: <AlertTriangle style={{ color: checked ? 'var(--danger-color)' : 'var(--warning-color)' }} />,
      content: checked 
        ? 'Warning: Enabling emergency pause will freeze new deposits, borrows, and marketplace matching on-chain. Are you sure?'
        : 'Are you sure you want to resume standard smart contract operations?',
      okText: checked ? 'Freeze Protocol' : 'Resume Protocol',
      okType: checked ? 'danger' : 'primary',
      cancelText: 'Cancel',
      onOk: () => {
        setEmergencyWithdrawActive(checked);
        message.success(checked ? 'Protocol successfully paused (Simulated)' : 'Protocol operations resumed (Simulated)');
      }
    });
  };

  // Environment Settings Reset Quick Control
  const handleResetData = () => {
    modal.confirm({
      title: 'Reset simulated application state?',
      icon: <RefreshCw style={{ color: 'var(--warning-color)' }} />,
      content: 'This will reset all cache records and restore oracle prices & mock loans to their default startup values. Proceed?',
      okText: 'Reset Now',
      cancelText: 'Cancel',
      onOk: () => {
        if (typeof window !== 'undefined' && (window as any).clearLegacyFrontendData) {
          (window as any).clearLegacyFrontendData();
          message.success('State cleared. Reloading page...');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      }
    });
  };

  // Simulated metrics rows for the UI preview when price changes
  const previewRows = useMemo(() => {
    return activeLoans.map((loan) => {
      const newHF = calculateHealthFactor(
        loan.collateralAmount,
        newPrice,
        loan.outstandingDebt,
        usdcPrice,
        loan.liquidationThreshold
      );

      return {
        key: loan.id,
        id: loan.id,
        borrower: loan.borrower,
        debt: loan.outstandingDebt,
        collateral: loan.collateralAmount,
        oldHF: loan.healthFactor,
        newHF,
        oldRisk: getRiskZone(loan.healthFactor),
        newRisk: getRiskZone(newHF),
        status: loan.status,
      };
    });
  }, [activeLoans, newPrice, usdcPrice]);

  const impactRows = useMemo(() => {
    return lastImpacts.map((impact) => {
      const loan = loans.find((item) => item.id === impact.loanId);
      return {
        key: impact.loanId,
        id: impact.loanId,
        borrower: loan?.borrower ?? 'Unknown',
        debt: loan?.outstandingDebt ?? 0,
        collateral: loan?.collateralAmount ?? 0,
        oldHF: impact.oldHF,
        newHF: impact.newHF,
        oldRisk: getRiskZone(impact.oldHF),
        newRisk: getRiskZone(impact.newHF),
        status: impact.newStatus,
      };
    });
  }, [lastImpacts, loans]);

  const oraclePreviewRows = lastImpacts.length > 0 ? impactRows : previewRows;
  const priceChangePercent = xlmPrice > 0 ? ((newPrice - xlmPrice) / xlmPrice) * 100 : 0;

  // UI Columns Specifications
  const oracleColumns = [
    {
      title: 'Loan ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Button type="link" onClick={() => navigate(`/app/loans/${id}`)} style={{ padding: 0, fontFamily: 'var(--font-mono)' }}>
          #{id.slice(0, 8)}
        </Button>
      ),
    },
    {
      title: 'Borrower Address',
      dataIndex: 'borrower',
      key: 'borrower',
      render: (borrower: string) => (
        <Text copyable={{ text: borrower }} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {formatAddress(borrower)}
        </Text>
      ),
    },
    {
      title: 'Debt Balance',
      dataIndex: 'debt',
      key: 'debt',
      render: (debt: number) => formatCurrency(debt, 'USDC'),
    },
    {
      title: 'Current HF',
      dataIndex: 'oldHF',
      key: 'oldHF',
      render: (hf: number) => <Text style={{ color: 'var(--text-muted)' }}>{hf.toFixed(2)}</Text>,
    },
    {
      title: 'Projected HF',
      dataIndex: 'newHF',
      key: 'newHF',
      render: (hf: number, record: any) => {
        const isDropped = hf < record.oldHF;
        const color = hf < 1.2 ? 'var(--danger-color)' : hf < 1.4 ? 'var(--warning-color)' : 'var(--success-color)';
        return (
          <Space>
            <Text strong style={{ color }}>{hf.toFixed(2)}</Text>
            {isDropped ? (
              <TrendingDown size={14} style={{ color: 'var(--danger-color)' }} />
            ) : (
              <TrendingUp size={14} style={{ color: 'var(--success-color)' }} />
            )}
          </Space>
        );
      },
    },
    {
      title: 'New Risk Tier',
      dataIndex: 'newRisk',
      key: 'newRisk',
      render: (risk: ReturnType<typeof getRiskZone>) => <RiskBadge zone={risk} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: typeof loans[number]['status']) => <LoanStatusBadge status={status} />,
    },
  ];

  const riskColumns = [
    {
      title: 'Loan ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Button type="link" onClick={() => navigate(`/app/loans/${id}`)} style={{ padding: 0, fontFamily: 'var(--font-mono)' }}>
          #{id.slice(0, 8)}
        </Button>
      ),
    },
    {
      title: 'Borrower',
      dataIndex: 'borrower',
      key: 'borrower',
      render: (borrower: string) => (
        <Text copyable={{ text: borrower }} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {formatAddress(borrower)}
        </Text>
      ),
    },
    {
      title: 'Outstanding Debt',
      dataIndex: 'outstandingDebt',
      key: 'outstandingDebt',
      render: (debt: number) => formatCurrency(debt, 'USDC'),
    },
    {
      title: 'Locked Collateral',
      dataIndex: 'collateralAmount',
      key: 'collateralAmount',
      render: (amount: number) => (
        <Space direction="vertical" size={0}>
          <Text>{formatCurrency(amount, 'XLM')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>≈ {formatCurrency(amount * xlmPrice, 'USDC')}</Text>
        </Space>
      ),
    },
    {
      title: 'Health Factor (HF)',
      dataIndex: 'healthFactor',
      key: 'healthFactor',
      render: (hf: number) => (
        <Text strong style={{ color: hf < 1.2 ? 'var(--danger-color)' : hf < 1.4 ? 'var(--warning-color)' : 'var(--success-color)' }}>
          {hf.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: typeof loans[number]['status']) => <LoanStatusBadge status={status} />,
    },
  ];

  const offerColumns = [
    {
      title: 'Offer ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)' }}>#{id.slice(0, 8)}</Text>
      ),
    },
    {
      title: 'Lender Address',
      dataIndex: 'lender',
      key: 'lender',
      render: (lender: string) => (
        <Text copyable={{ text: lender }} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {formatAddress(lender)}
        </Text>
      ),
    },
    {
      title: 'Offered Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => formatCurrency(amount, 'USDC'),
    },
    {
      title: 'Interest Rate (APR)',
      dataIndex: 'apr',
      key: 'apr',
      render: (apr: number) => (
        <Tag color="cyan" style={{ margin: 0 }}>{apr.toFixed(2)}%</Tag>
      ),
    },
    {
      title: 'Max allowed LTV',
      dataIndex: 'maxLTV',
      key: 'maxLTV',
      render: (ltv: number) => `${Math.round(ltv * 100)}%`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: typeof loanOffers[number]['status']) => <OfferStatusBadge status={status} />,
    },
  ];

  const transactionColumns = [
    {
      title: 'Event Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        let color = 'blue';
        if (type === 'UPDATE_ORACLE') color = 'purple';
        if (type === 'LIQUIDATE') color = 'red';
        if (type === 'PARTIAL_REPAY' || type === 'FULL_REPAY') color = 'green';
        return <Tag color={color} style={{ margin: 0 }}>{formatTxType(type)}</Tag>;
      },
    },
    {
      title: 'Caller Address',
      dataIndex: 'user',
      key: 'user',
      render: (user: string) => (
        <Text copyable={{ text: user }} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
          {formatAddress(user)}
        </Text>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_: unknown, record: typeof transactions[number]) => (
        <Text strong>{record.amount.toLocaleString()} {record.asset}</Text>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (details: string) => <Text style={{ fontSize: 13 }} type="secondary">{details}</Text>,
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => formatDateTime(timestamp),
    },
    {
      title: 'Ledger Registry',
      dataIndex: 'explorerUrl',
      key: 'explorerUrl',
      render: (explorerUrl?: string) => explorerUrl ? (
        <a href={explorerUrl} target="_blank" rel="noreferrer" className="admin-trend-badge" style={{ backgroundColor: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary-color)' }}>
          Soroban <ExternalLink size={10} />
        </a>
      ) : (
        <Text type="secondary">Simulation</Text>
      ),
    },
  ];

  return (
    <div className="page-stack animate-fade-in">
      {/* Authorization Status Banner */}
      <div className="admin-header-bg">
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={16}>
            <Space size={12} style={{ marginBottom: 12 }} wrap>
              <Tag color="purple" style={{ padding: '4px 12px', fontSize: 12 }}>
                <Space size={4}><ShieldCheck size={14} /> SYSTEM GOVERNANCE</Space>
              </Tag>
              {isCurrentWalletAdmin ? (
                <Badge status="processing" text="Supreme Administrator Session Active" style={{ color: 'var(--success-color)', fontWeight: 600 }} />
              ) : (
                <Tag color="red" style={{ padding: '4px 12px', fontSize: 11 }}>UNAUTHORIZED WALLET CONNECTED</Tag>
              )}
            </Space>
            
            <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 32 }}>
              Nexus Governance Hub
            </Title>
            
            <Paragraph style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
              Configured admin authority: <Text code copyable={{ text: ADMIN_WALLET_ADDRESS }} style={{ fontFamily: 'var(--font-mono)' }}>{ADMIN_WALLET_ADDRESS}</Text>
            </Paragraph>

            <div style={{ marginTop: 12 }}>
              <Text type="secondary">Current Session Address: </Text>
              <Text strong style={{ fontFamily: 'var(--font-mono)' }}>
                {wallet.address ? `${wallet.address.slice(0, 10)}...${wallet.address.slice(-10)}` : 'Disconnected'}
              </Text>
            </div>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space wrap>
              {!isCurrentWalletAdmin && (
                <Button 
                  type="primary" 
                  onClick={handleConnectAdminDemo}
                  icon={<Wallet size={16} />}
                >
                  Connect Demo Admin Wallet
                </Button>
              )}
              <Button 
                onClick={handleResetData}
                icon={<RefreshCw size={16} />}
              >
                Reset Demo
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Primary Statistics Grid */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <div className="admin-stat-card-glow-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span className="metric-card-label">Protocol TVL</span>
                <div className="metric-card-value" style={{ marginTop: 6 }}>
                  {formatCurrency(tvl, 'USDC')}
                </div>
                <div className="admin-trend-badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--success-color)', marginTop: 8 }}>
                  <TrendingUp size={12} />
                  <span>+{priceChangePercent > 0 ? priceChangePercent.toFixed(1) : '0.0'}% (XLM delta)</span>
                </div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-color)' }}>
                <ShieldCheck size={22} />
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="admin-stat-card-glow-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span className="metric-card-label">Total Outstanding Debt</span>
                <div className="metric-card-value" style={{ marginTop: 6 }}>
                  {formatCurrency(totalBorrowed, 'USDC')}
                </div>
                <span className="metric-card-sub" style={{ display: 'block', marginTop: 12 }}>
                  Debt/Collateral ratio: {tvl > 0 ? ((totalBorrowed / tvl) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(6, 182, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary-color)' }}>
                <Coins size={22} />
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="admin-stat-card-glow-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span className="metric-card-label">Available Liquidity</span>
                <div className="metric-card-value" style={{ marginTop: 6 }}>
                  {formatCurrency(availableLiquidity, 'USDC')}
                </div>
                <span className="metric-card-sub" style={{ display: 'block', marginTop: 12 }}>
                  Active matching offers: {activeOffers.length}
                </span>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success-color)' }}>
                <ShoppingBag size={22} />
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <div className="admin-stat-card-glow-inner">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <span className="metric-card-label">At-Risk Loans</span>
                <div className="metric-card-value" style={{ marginTop: 6, color: liquidatableLoans.length > 0 ? 'var(--danger-color)' : 'var(--text-main)' }}>
                  {warningLoans.length}
                </div>
                <span className="metric-card-sub" style={{ display: 'block', marginTop: 12 }}>
                  Directly Liquidatable: {liquidatableLoans.length}
                </span>
              </div>
              <div className={`width: 44; height: 44; border-radius: 12px; display: flex; align-items: center; justify-content: center; ${liquidatableLoans.length > 0 ? 'admin-pulse-red' : ''}`} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: liquidatableLoans.length > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: liquidatableLoans.length > 0 ? 'var(--danger-color)' : 'var(--warning-color)' }}>
                <Flame size={22} />
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* Tabs Layout */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        size="large"
        items={[
          {
            key: 'overview',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} /> System Overview
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                {/* Chart: TVL & Borrow Activity */}
                <Col xs={24} lg={16}>
                  <Card 
                    title="Protocol Liquidity and Debt Velocity (7 Days Trend)" 
                    style={{ border: '1px solid var(--border-color)' }}
                  >
                    <div style={{ height: 350, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="debtGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--secondary-color)" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="var(--secondary-color)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                          <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                          <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                          <RechartsTooltip />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                          <Area type="monotone" dataKey="Total TVL ($)" stroke="var(--primary-color)" strokeWidth={2} fillOpacity={1} fill="url(#tvlGradient)" />
                          <Area type="monotone" dataKey="Total Debt ($)" stroke="var(--secondary-color)" strokeWidth={2} fillOpacity={1} fill="url(#debtGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>

                {/* Circular Gauge: System Health Index */}
                <Col xs={24} lg={8}>
                  <Card 
                    title="Overall System Health" 
                    style={{ border: '1px solid var(--border-color)', height: '100%' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 280, padding: '10px 0' }}>
                      <Progress
                        type="dashboard"
                        percent={avgHealthFactor > 0 ? Math.min(100, (avgHealthFactor / 2.5) * 100) : 100}
                        format={() => (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: 32, fontWeight: 800, color: avgHealthFactor < 1.2 ? 'var(--danger-color)' : avgHealthFactor < 1.4 ? 'var(--warning-color)' : 'var(--success-color)' }}>
                              {avgHealthFactor > 0 ? avgHealthFactor.toFixed(2) : '100%'}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                              Avg Health Factor
                            </span>
                          </div>
                        )}
                        strokeColor={{
                          '0%': 'var(--danger-color)',
                          '50%': 'var(--warning-color)',
                          '100%': 'var(--success-color)',
                        }}
                        strokeWidth={8}
                        width={180}
                      />
                      
                      <div style={{ marginTop: 24, width: '100%' }}>
                        <div className="admin-card-inner-desc" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <Info size={16} style={{ color: 'var(--primary-color)', flexShrink: 0, marginTop: 2 }} />
                          <div>
                            <Text strong style={{ fontSize: 13, display: 'block' }}>System health remains stable</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              The average health factor is {avgHealthFactor.toFixed(2)}. Capital liquidation triggers are monitored automatically by chain oracles.
                            </Text>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>

                {/* Risk Distribution & Health Vs Price */}
                <Col xs={24} md={12}>
                  <Card title="Loan Portfolio Risk Profile" style={{ border: '1px solid var(--border-color)' }}>
                    <div style={{ height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {riskDistributionData.length > 0 ? (
                        <Row align="middle">
                          <Col span={14}>
                            <ResponsiveContainer width="100%" height={220}>
                              <PieChart>
                                <Pie
                                  data={riskDistributionData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={70}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {riskDistributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </Col>
                          <Col span={10}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {riskDistributionData.map((item, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: item.color }} />
                                  <div>
                                    <Text style={{ fontSize: 12, display: 'block' }}>{item.name}</Text>
                                    <Text strong style={{ fontSize: 13 }}>{item.value} Loan(s)</Text>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Col>
                        </Row>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                          <Text type="secondary">No active loans found on-chain.</Text>
                        </div>
                      )}
                    </div>
                  </Card>
                </Col>

                <Col xs={24} md={12}>
                  <Card title="XLM Price Feed vs Average Health Factor" style={{ border: '1px solid var(--border-color)' }}>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ReLineChart data={priceVsHealthChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                          <XAxis dataKey="name" fontSize={11} stroke="var(--text-muted)" tickLine={false} />
                          <YAxis yAxisId="left" stroke="var(--primary-color)" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis yAxisId="right" orientation="right" stroke="var(--success-color)" fontSize={11} tickLine={false} axisLine={false} />
                          <RechartsTooltip />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                          <Line yAxisId="left" type="monotone" dataKey="XLM Price ($)" stroke="var(--primary-color)" strokeWidth={2} dot={{ r: 3 }} />
                          <Line yAxisId="right" type="monotone" dataKey="System Health (Avg HF)" stroke="var(--success-color)" strokeWidth={2} dot={{ r: 3 }} />
                        </ReLineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'oracle',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LineChart size={16} /> Oracle & Simulation
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                {/* Left Side: Oracle Admin Control */}
                <Col xs={24} lg={10}>
                  <Card 
                    title={
                      <Space>
                        <Sliders size={16} style={{ color: 'var(--primary-color)' }} />
                        Oracle Price Engine
                      </Space>
                    }
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label="Current XLM Price">
                          <Text strong>${xlmPrice.toFixed(7)} USDC</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Pending Price Shift">
                          <Tag color={priceChangePercent < 0 ? 'red' : priceChangePercent > 0 ? 'green' : 'default'}>
                            {priceChangePercent > 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Last Node Sync">
                          {formatDateTime(xlmPriceInfo?.lastUpdated)}
                        </Descriptions.Item>
                      </Descriptions>

                      <Form form={form} layout="vertical" initialValues={{ price: xlmPrice }}>
                        <Form.Item 
                          label="Publish New Price (USDC)" 
                          name="price" 
                          rules={[{ required: true, message: 'Please input a valid price value.' }]}
                          extra="Enter price to prepare signature payload for the Soroban smart contract."
                        >
                          <InputNumber
                            min={0.0000001}
                            max={10}
                            step={0.001}
                            precision={7}
                            style={{ width: '100%', height: 40 }}
                            onChange={(value) => {
                              setNewPrice(value ?? 0);
                              setLastImpacts([]);
                            }}
                          />
                        </Form.Item>

                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                          <Button
                            type="primary"
                            icon={<Play size={14} />}
                            loading={updatingOracle}
                            disabled={!isCurrentWalletAdmin || newPrice <= 0}
                            onClick={handleUpdateOracle}
                            block
                          >
                            Update Oracle Price (Sign Tx)
                          </Button>
                          
                          <Button
                            icon={<RefreshCw size={14} />}
                            loading={recalculating}
                            disabled={!isCurrentWalletAdmin}
                            onClick={handleRecalculate}
                            block
                          >
                            Recalculate Loan Health Factors
                          </Button>
                        </Space>
                      </Form>

                      {latestOracleTx?.txHash && (
                        <div style={{ marginTop: 12 }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Last On-chain Transaction Receipt:</Text>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, background: 'var(--border-light)', borderRadius: 6 }}>
                            <Text code style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{latestOracleTx.txHash.slice(0, 16)}...</Text>
                            <Space size={8}>
                              <Button type="text" size="small" icon={<Copy size={12} />} onClick={() => handleCopyText(latestOracleTx.txHash || '', 'Tx Hash')} />
                              {latestOracleTx.explorerUrl && (
                                <a href={latestOracleTx.explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                                  Open <ExternalLink size={10} />
                                </a>
                              )}
                            </Space>
                          </div>
                          <Descriptions size="small" column={1} bordered style={{ marginTop: 8 }}>
                            <Descriptions.Item label="Ledger">{latestOracleTx.ledger ?? 'Synced'}</Descriptions.Item>
                          </Descriptions>
                        </div>
                      )}
                    </div>
                  </Card>
                </Col>

                {/* Right Side: Price Shock Simulator */}
                <Col xs={24} lg={14}>
                  <Card 
                    title={
                      <Space>
                        <AlertTriangle size={16} style={{ color: 'var(--warning-color)' }} />
                        Market Stress Simulator
                      </Space>
                    }
                    className="shock-slider-card"
                  >
                    <Paragraph>
                      Simulate a price shift in the collateral asset (XLM) to analyze its impact on loan health factors and evaluate system-wide risk.
                    </Paragraph>
                    
                    <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.7)', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                      <Row gutter={24} align="middle">
                        <Col span={6}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Collateral Shift</Text>
                          <Text strong style={{ fontSize: 18, color: simulatedDropPercent < 0 ? 'var(--danger-color)' : simulatedDropPercent > 0 ? 'var(--success-color)' : 'var(--text-main)' }}>
                            {simulatedDropPercent > 0 ? '+' : ''}{simulatedDropPercent}%
                          </Text>
                        </Col>
                        <Col span={12}>
                          <Slider
                            min={-60}
                            max={60}
                            step={5}
                            value={simulatedDropPercent}
                            onChange={(val) => setSimulatedDropPercent(val)}
                            tooltip={{ formatter: (v) => `${v}%` }}
                          />
                        </Col>
                        <Col span={6} style={{ textAlign: 'right' }}>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Simulated Price</Text>
                          <Text strong style={{ fontSize: 16 }}>${simulatedPrice.toFixed(4)} USDC</Text>
                        </Col>
                      </Row>

                      {/* Shock Preset buttons */}
                      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                        <Button size="small" type="dashed" danger onClick={() => setSimulatedDropPercent(-50)}>Shock -50% (Crash)</Button>
                        <Button size="small" type="dashed" danger onClick={() => setSimulatedDropPercent(-30)}>Shock -30%</Button>
                        <Button size="small" type="dashed" onClick={() => setSimulatedDropPercent(-10)}>Shock -10%</Button>
                        <Button size="small" onClick={() => setSimulatedDropPercent(0)}>Reset (0%)</Button>
                        <Button size="small" type="dashed" style={{ color: 'var(--success-color)', borderColor: 'var(--success-color)' }} onClick={() => setSimulatedDropPercent(20)}>Surge +20%</Button>
                      </div>
                    </div>

                    <div style={{ marginTop: 24 }}>
                      <Title level={5}>Projected Loan States:</Title>
                      <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
                        <Col span={6}>
                          <Card styles={{ body: { padding: 12 } }} style={{ textAlign: 'center', borderColor: 'var(--success-color)' }}>
                            <Statistic title="Safe" value={shockSimulationStats.safe} valueStyle={{ color: 'var(--success-color)', fontSize: 20 }} />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card styles={{ body: { padding: 12 } }} style={{ textAlign: 'center', borderColor: 'var(--warning-color)' }}>
                            <Statistic title="Warning" value={shockSimulationStats.warning} valueStyle={{ color: 'var(--warning-color)', fontSize: 20 }} />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card styles={{ body: { padding: 12 } }} style={{ textAlign: 'center', borderColor: '#E056FD' }}>
                            <Statistic title="Critical" value={shockSimulationStats.danger} valueStyle={{ color: '#E056FD', fontSize: 20 }} />
                          </Card>
                        </Col>
                        <Col span={6}>
                          <Card styles={{ body: { padding: 12 } }} style={{ textAlign: 'center', borderColor: 'var(--danger-color)', background: shockSimulationStats.liquidatable > 0 ? 'rgba(239,68,68,0.02)' : 'white' }}>
                            <Statistic title="Liquidatable" value={shockSimulationStats.liquidatable} valueStyle={{ color: 'var(--danger-color)', fontSize: 20 }} />
                          </Card>
                        </Col>
                      </Row>
                    </div>

                    <div style={{ marginTop: 20, padding: 12, background: 'rgba(239,68,68,0.04)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.1)' }}>
                      <Space>
                        <AlertTriangle size={18} style={{ color: 'var(--danger-color)', flexShrink: 0 }} />
                        <div>
                          <Text strong style={{ fontSize: 13 }}>Simulated Debt At Risk:</Text>
                          <Text strong style={{ fontSize: 16, color: 'var(--danger-color)', display: 'block' }}>
                            {formatCurrency(shockSimulationStats.totalDebtAtRisk, 'USDC')}
                          </Text>
                        </div>
                      </Space>
                    </div>
                  </Card>
                </Col>

                {/* Preview of Affected Loans */}
                <Col xs={24}>
                  <Card title="Impact Assessment Preview" styles={{ body: { padding: 0 } }}>
                    <Table 
                      columns={oracleColumns} 
                      dataSource={oraclePreviewRows} 
                      pagination={{ pageSize: 5 }} 
                      scroll={{ x: 800 }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'risk',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Flame size={16} /> Risk Monitoring
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Alert
                  type="info"
                  showIcon
                  message="System Risk Queue (Read-Only)"
                  description="This monitor shows active loan parameters to assess protocol liquidation status. In accordance with peer-to-peer system parameters, the contract administrator does not arbitrate, approve, or manually resolve loan contracts."
                />

                <Card title="At-Risk Loan Contracts Ledger" styles={{ body: { padding: 0 } }}>
                  <Table 
                    columns={riskColumns} 
                    dataSource={warningLoans} 
                    rowKey="id" 
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: 'No critical risk loans found.' }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'offers',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingBag size={16} /> Marketplace Supply
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24}>
                  <Card title="Lender Liquidity Offers Book" styles={{ body: { padding: 0 } }}>
                    <Table 
                      columns={offerColumns} 
                      dataSource={loanOffers} 
                      rowKey="id" 
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 800 }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'runtime',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} /> Smart Contract Configuration
              </span>
            ),
            children: (
              <Row gutter={[24, 24]}>
                {/* Contract Addresses Card */}
                <Col xs={24} lg={10}>
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Card 
                      title={
                        <Space>
                          <Database size={16} style={{ color: 'var(--primary-color)' }} />
                          Smart Contract Registry
                        </Space>
                      }
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Descriptions bordered column={1} size="small" styles={{ label: { width: 140, fontWeight: 600 } }}>
                          <Descriptions.Item label="Data Mode">
                            <Tag color={DATA_MODE === 'api' ? 'green' : 'orange'}>{DATA_MODE.toUpperCase()}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Chain Mode">
                            <Tag color={CHAIN_MODE === 'live' ? 'green' : 'gold'}>{CHAIN_MODE.toUpperCase()}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Network">
                            <Tag color="blue">{NETWORK.toUpperCase()}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="Oracle Contract">
                            <Space size={8}>
                              <Text code style={{ fontSize: 11 }}>{formatAddress(CONTRACTS.oracle)}</Text>
                              <Button size="small" type="text" icon={<Copy size={12} />} onClick={() => handleCopyText(CONTRACTS.oracle, 'Oracle Contract Address')} />
                            </Space>
                          </Descriptions.Item>
                          <Descriptions.Item label="Loan Manager">
                            <Space size={8}>
                              <Text code style={{ fontSize: 11 }}>{formatAddress(CONTRACTS.loanManager)}</Text>
                              <Button size="small" type="text" icon={<Copy size={12} />} onClick={() => handleCopyText(CONTRACTS.loanManager, 'Loan Manager Address')} />
                            </Space>
                          </Descriptions.Item>
                          <Descriptions.Item label="Marketplace">
                            <Space size={8}>
                              <Text code style={{ fontSize: 11 }}>{formatAddress(CONTRACTS.marketplace)}</Text>
                              <Button size="small" type="text" icon={<Copy size={12} />} onClick={() => handleCopyText(CONTRACTS.marketplace, 'Marketplace Address')} />
                            </Space>
                          </Descriptions.Item>
                        </Descriptions>

                        <Card style={{ backgroundColor: 'var(--border-light)', border: 'none', borderRadius: 8 }}>
                          <Title level={5} style={{ fontSize: 13, margin: 0, marginBottom: 8 }}>Soroban Nodes Config</Title>
                          <Descriptions column={1} size="small">
                            <Descriptions.Item label="RPC Server">
                              <Text copyable style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{RPC_URL}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="Horizon API">
                              <Text copyable style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{HORIZON_URL}</Text>
                            </Descriptions.Item>
                          </Descriptions>
                        </Card>
                      </div>
                    </Card>

                    {/* Developer settings with Emergency Toggle */}
                    <Card 
                      title={
                        <Space>
                          <Settings size={16} />
                          Developer Settings
                        </Space>
                      }
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ display: 'block' }}>Developer Mode</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>Unlock emergency administrative dials</Text>
                          </div>
                          <Switch 
                            checked={devModeActive} 
                            onChange={(checked) => {
                              setDevModeActive(checked);
                              if (!checked) setEmergencyWithdrawActive(false);
                            }} 
                          />
                        </div>

                        {devModeActive && (
                          <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.02)', border: '1px dashed var(--danger-color)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <Text strong style={{ color: 'var(--danger-color)', display: 'block' }}>Emergency Withdraw</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>Halt all contract actions instantly</Text>
                              </div>
                              <Switch 
                                checked={emergencyWithdrawActive}
                                onChange={handleEmergencyWithdrawToggle}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </Space>
                </Col>

                {/* Audit Event Ledger */}
                <Col xs={24} lg={14}>
                  <Card 
                    title={
                      <Space>
                        <Activity size={16} style={{ color: 'var(--primary-color)' }} />
                        Transaction Audit Ledger
                      </Space>
                    }
                    styles={{ body: { padding: 0 } }}
                  >
                    <Table 
                      columns={transactionColumns} 
                      dataSource={transactions} 
                      rowKey="id" 
                      pagination={{ pageSize: 8 }}
                      scroll={{ x: 750 }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />
    </div>
  );
};
