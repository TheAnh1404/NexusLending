import React, { useState } from 'react';
import { useAppContext } from '../app/AppContext';
import { filterWalletActivities } from '../utils/activity';
import { formatAddress, formatCurrency, isOpenLoanStatus } from '../utils/finance';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { DashboardAnalytics, MaturityBucketKey, RiskZone } from '../types';
import { analyticsApi } from '../services/api/analytics.api';
import {
  Card,
  Col,
  Row,
  Typography,
  Tag,
  Button,
  Progress,
  Space,
} from 'antd';
import {
  Coins,
  FileBadge2,
  TrendingUp,
  ShieldCheck,
  Layers,
  Activity,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Calendar,
  ChevronRight,
  PlusCircle,
  Copy,
  Check,
  Radar,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { SwapModal } from '../components/common/SwapModal';

const { Title, Paragraph, Text } = Typography;

const LIVE_REFRESH_INTERVAL_MS = 10_000;

const EMPTY_ANALYTICS_TEXT = 'Chua co du lieu';
const BACKEND_ERROR_TEXT = 'Khong the tai du lieu backend.';

const riskZoneMeta: Record<RiskZone, { color: string; background: string }> = {
  SAFE: {
    color: 'var(--success-color)',
    background: 'rgba(16, 185, 129, 0.08)',
  },
  WARNING: {
    color: 'var(--warning-color)',
    background: 'rgba(245, 158, 11, 0.1)',
  },
  LIQUIDATION_PLANNING: {
    color: 'var(--danger-color)',
    background: 'rgba(239, 68, 68, 0.1)',
  },
};

const maturityMeta: Record<MaturityBucketKey, { color: string; background: string }> = {
  defaulted: {
    color: 'var(--danger-color)',
    background: 'rgba(239, 68, 68, 0.1)',
  },
  grace: {
    color: 'var(--warning-color)',
    background: 'rgba(245, 158, 11, 0.1)',
  },
  due_7d: {
    color: 'var(--secondary-color)',
    background: 'rgba(6, 182, 212, 0.1)',
  },
  due_30d: {
    color: 'var(--primary-color)',
    background: 'rgba(79, 70, 229, 0.08)',
  },
  later: {
    color: 'var(--text-muted)',
    background: 'var(--border-light)',
  },
};

export const DashboardPage: React.FC = () => {
  const { loans, loanOffers, oraclePrices, activities, wallet, refreshData } = useAppContext();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [remoteAnalytics, setRemoteAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const walletActivities = React.useMemo(
    () => filterWalletActivities(activities, wallet.address, loans, loanOffers),
    [activities, loanOffers, loans, wallet.address]
  );

  const handleCopy = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 1. Portfolio Calculations (User Specific)
  const myLentLoans = loans.filter((l) => l.lender === wallet.address && isOpenLoanStatus(l.status));
  const myBorrowedLoans = loans.filter((l) => l.borrower === wallet.address && isOpenLoanStatus(l.status));
  
  const myLentAmount = myLentLoans.reduce((sum, l) => sum + l.amount, 0);
  const myBorrowedAmount = myBorrowedLoans.reduce((sum, l) => sum + l.amount, 0);
  
  const myCollateralLockedXLM = myBorrowedLoans.reduce((sum, l) => sum + l.collateralAmount, 0);
  const myCollateralLockedVal = myCollateralLockedXLM * xlmPrice;
  
  const myActiveLoansCount = myLentLoans.length + myBorrowedLoans.length;
  
  const myAvgHF =
    myBorrowedLoans.length > 0
      ? myBorrowedLoans.reduce((sum, l) => sum + l.healthFactor, 0) / myBorrowedLoans.length
      : 0;

  // 2. Protocol Health Calculations (Global)
  const openLoansList = loans.filter((l) => isOpenLoanStatus(l.status));
  const activeLoansList = openLoansList.filter((l) => l.status !== 'PendingCollateral');
  const fundedOffers = loanOffers.filter((offer) => ['Funding', 'Active'].includes(offer.status ?? 'Draft'));

  const totalBorrowedVal = activeLoansList.reduce((sum, l) => sum + l.amount, 0);
  const totalCollateralLockedXLM = activeLoansList.reduce((sum, l) => sum + l.collateralAmount, 0);
  const totalCollateralLockedVal = totalCollateralLockedXLM * xlmPrice;

  // TVL = Collateral locked + USDC funds remaining in offers
  const totalOffersVal = fundedOffers.reduce((sum, o) => sum + o.amount, 0);
  const tvl = totalCollateralLockedVal + totalOffersVal;
  const dashboardAnalytics = remoteAnalytics;
  const hasBackendAnalyticsData = dashboardAnalytics?.hasData === true;
  const riskChartData = hasBackendAnalyticsData
    ? dashboardAnalytics.riskExposure.buckets.filter((bucket) => bucket.loanCount > 0 || bucket.debtAmount > 0)
    : [];
  const maturityItems = hasBackendAnalyticsData
    ? dashboardAnalytics.repaymentCalendar.items.slice(0, 5)
    : [];
  const dashboardSyncedAt = dashboardAnalytics ? new Date(dashboardAnalytics.generatedAt) : null;
  const dashboardSyncLabel = dashboardSyncedAt && !Number.isNaN(dashboardSyncedAt.getTime())
    ? dashboardSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  const loadBackendAnalytics = React.useCallback(async (): Promise<boolean> => {
    setAnalyticsLoading(true);
    try {
      const analytics = await analyticsApi.dashboard();
      setRemoteAnalytics(analytics);
      setAnalyticsError(null);
      return true;
    } catch (error) {
      setRemoteAnalytics(null);
      setAnalyticsError(error instanceof Error ? error.message : 'Unable to load backend analytics.');
      return false;
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;

    const syncLiveData = async () => {
      void refreshData().catch((error) => {
        console.error('Unable to refresh dashboard context data:', error);
      });

      try {
        const analyticsLoaded = await loadBackendAnalytics();
        if (active) {
          setLastSyncedAt(analyticsLoaded ? new Date() : null);
        }
      } catch (error) {
        console.error('Unable to refresh backend analytics:', error);
      }
    };

    void syncLiveData();
    const intervalId = window.setInterval(() => {
      void syncLiveData();
    }, LIVE_REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadBackendAnalytics, refreshData]);

  // Render health factor score with colors
  const renderHF = (hf: number) => {
    if (hf >= 2) return <span style={{ color: 'var(--success-color)', fontWeight: 700 }}>{hf.toFixed(2)}</span>;
    if (hf >= 1.5) return <span style={{ color: 'var(--warning-color)', fontWeight: 700 }}>{hf.toFixed(2)}</span>;
    return <span style={{ color: 'var(--danger-color)', fontWeight: 700 }}>{hf.toFixed(2)}</span>;
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* 1. Welcome & Wallet Identity Banner (Stunning Glow Gradient) */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'relative',
          padding: '28px 32px',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px'
        }}
      >
        <div style={{ zIndex: 1 }}>
          <Tag color="cyan" style={{ border: 'none', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', marginBottom: '8px' }}>
            TESTNET ACTIVE
          </Tag>
          <Title level={2} style={{ color: '#FFFFFF', margin: 0, fontWeight: 800, fontSize: '26px', letterSpacing: '-0.02em' }}>
            Nexus Liquidity Dashboard
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.7)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Peer-to-peer isolated lending & borrowing built on Soroban smart contracts.
          </Paragraph>
          
          {wallet.connected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '8px', width: 'fit-content' }}>
              <Wallet size={14} style={{ color: '#06B6D4' }} />
              <Text style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                {wallet.address}
              </Text>
              <Button 
                type="text" 
                size="small" 
                onClick={handleCopy} 
                icon={copied ? <Check size={13} style={{ color: 'var(--success-color)' }} /> : <Copy size={13} style={{ color: '#FFFFFF' }} />} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            </div>
          )}
        </div>

        {/* Quick actions directly on header (Modern glassmorphic buttons) */}
        <div style={{ display: 'flex', gap: '12px', zIndex: 1 }}>
          <Button
            type="primary"
            icon={<PlusCircle size={16} />}
            onClick={() => navigate('/app/create-loan')}
            style={{
              height: '42px',
              fontWeight: 600,
              backgroundColor: 'var(--primary-color)',
              border: 'none',
              boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)'
            }}
          >
            Create Offer
          </Button>
          <Button
            ghost
            icon={<ArrowRightLeft size={16} />}
            onClick={() => setSwapModalOpen(true)}
            style={{
              height: '42px',
              fontWeight: 600,
              color: '#FFFFFF',
              borderColor: 'rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)'
            }}
          >
            Swap XLM / USDC
          </Button>
        </div>

        {/* Beautiful abstract grid pattern in the background */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(124, 58, 237, 0.15) 0%, transparent 50%)',
          pointerEvents: 'none'
        }} />
      </motion.div>

      {wallet.connected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Text style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
            <Wallet size={15} style={{ color: 'var(--primary-color)' }} /> My Active Portfolio Overview
          </Text>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>LENT CAPITAL</Text>
                <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{formatCurrency(myLentAmount, 'USDC')}</Title>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>BORROWED DEBT</Text>
                <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{formatCurrency(myBorrowedAmount, 'USDC')}</Title>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>LOCKED COLLATERAL</Text>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{myCollateralLockedXLM.toLocaleString()} XLM</Title>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    (${myCollateralLockedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </Text>
                </div>
              </div>
            </Col>
            <Col xs={12} md={6}>
              <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--shadow-sm)' }}>
                <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>AVERAGE HEALTH FACTOR</Text>
                <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800, color: myAvgHF >= 2.0 ? 'var(--success-color)' : myAvgHF >= 1.5 ? 'var(--warning-color)' : myAvgHF > 0 ? 'var(--danger-color)' : 'inherit' }}>
                  {myAvgHF > 0 ? myAvgHF.toFixed(2) : 'N/A'}
                </Title>
              </div>
            </Col>
          </Row>
        </div>
      )}

      {/* 2. Oracle Ticker & Basic Stats Grid */}
      <Row gutter={[20, 20]}>
        <Col xs={24} md={8}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Protocol TVL</Text>
              <Title level={3} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{formatCurrency(tvl, 'USDC')}</Title>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(79, 70, 229, 0.08)', borderRadius: '10px', color: 'var(--primary-color)' }}>
              <Coins size={22} />
            </div>
          </div>
        </Col>
        
        <Col xs={24} md={8}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Borrowed</Text>
              <Title level={3} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{formatCurrency(totalBorrowedVal, 'USDC')}</Title>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderRadius: '10px', color: 'var(--secondary-color)' }}>
              <FileBadge2 size={22} />
            </div>
          </div>
        </Col>

        <Col xs={24} md={8}>
          <div style={{
            background: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>XLM Oracle Price</Text>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <Title level={3} style={{ margin: 0, fontWeight: 800 }}>${xlmPrice.toFixed(4)}</Title>
                <Tag color="success" style={{ border: 'none', margin: 0, fontSize: '10px', fontWeight: 700 }}>
                  USDC Feed
                </Tag>
              </div>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', color: 'var(--success-color)' }}>
              <TrendingUp size={22} />
            </div>
          </div>
        </Col>
      </Row>

      {/* 3. Risk Radar & Repayment Calendar */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700 }}>
                  <Radar size={18} style={{ color: 'var(--primary-color)' }} />
                  Risk Exposure Radar
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <Activity size={12} className="animate-pulse" style={{ color: 'var(--success-color)' }} />
                  Backend analytics
                  {lastSyncedAt ? ` - synced ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
                </span>
              </div>
            }
            style={{ border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}
            styles={{ body: { padding: '18px 20px 20px 20px' } }}
          >
            <Row gutter={[18, 18]} align="middle">
              <Col xs={24} md={9}>
                <div style={{ height: '210px', position: 'relative' }}>
                  {riskChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={riskChartData}
                          dataKey="debtAmount"
                          nameKey="label"
                          innerRadius={62}
                          outerRadius={86}
                          paddingAngle={3}
                          stroke="var(--surface-color)"
                          strokeWidth={3}
                        >
                          {riskChartData.map((bucket) => (
                            <Cell key={bucket.riskZone} fill={riskZoneMeta[bucket.riskZone].color} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                          formatter={(value, name) => [formatCurrency(Number(value), 'USDC'), name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                      <Radar size={34} />
                      <Text type="secondary">{EMPTY_ANALYTICS_TEXT}</Text>
                    </div>
                  )}
                  {riskChartData.length > 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>AT RISK</Text>
                      <Text strong style={{ fontSize: '18px' }}>{formatCurrency(dashboardAnalytics?.riskExposure.atRiskDebt ?? 0, 'USDC')}</Text>
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>ACTIVE DEBT</Text>
                    <Text strong style={{ display: 'block', fontSize: '13px' }}>{hasBackendAnalyticsData ? formatCurrency(dashboardAnalytics?.riskExposure.totalDebt ?? 0, 'USDC') : EMPTY_ANALYTICS_TEXT}</Text>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>AVG HF</Text>
                    <Text strong style={{ display: 'block', fontSize: '13px' }}>
                      {hasBackendAnalyticsData
                        ? (dashboardAnalytics?.riskExposure.avgHealthFactor ?? 99) >= 99
                          ? '100% Safe'
                          : (dashboardAnalytics?.riskExposure.avgHealthFactor ?? 0).toFixed(2)
                        : EMPTY_ANALYTICS_TEXT}
                    </Text>
                  </div>
                </div>
              </Col>

              <Col xs={24} md={15}>
                {dashboardAnalytics && hasBackendAnalyticsData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(dashboardAnalytics?.riskExposure.buckets ?? []).map((bucket) => (
                    <div key={bucket.riskZone}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: riskZoneMeta[bucket.riskZone].color }} />
                          <Text strong style={{ fontSize: '13px' }}>{bucket.label}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>{bucket.loanCount} loans</Text>
                        </span>
                        <Text strong style={{ fontSize: '13px' }}>{formatCurrency(bucket.debtAmount, 'USDC')}</Text>
                      </div>
                      <Progress
                        percent={Math.min(100, bucket.debtSharePct)}
                        showInfo={false}
                        strokeColor={riskZoneMeta[bucket.riskZone].color}
                        trailColor="var(--border-light)"
                      />
                    </div>
                  ))}

                  <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <Text type="secondary" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Highest Risk Positions
                      </Text>
                      <Tag color="blue" style={{ margin: 0 }}>
                        Backend
                      </Tag>
                    </div>
                    {!hasBackendAnalyticsData || dashboardAnalytics?.riskExposure.topRiskLoans.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: '13px' }}>{EMPTY_ANALYTICS_TEXT}</Text>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {dashboardAnalytics.riskExposure.topRiskLoans.slice(0, 3).map((loan) => (
                          <button
                            key={loan.id}
                            type="button"
                            onClick={() => navigate(`/app/loans/${loan.id}`)}
                            style={{
                              width: '100%',
                              border: '1px solid var(--border-light)',
                              background: 'var(--surface-color)',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ minWidth: 0 }}>
                              <Text strong style={{ display: 'block', fontSize: '13px' }}>{formatCurrency(loan.outstandingDebt, loan.loanAsset)}</Text>
                              <Text type="secondary" style={{ display: 'block', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Borrower {formatAddress(loan.borrowerWallet)} - HF {loan.healthFactor.toFixed(2)}
                              </Text>
                            </span>
                            <Tag
                              style={{ margin: 0, color: riskZoneMeta[loan.riskZone].color, background: riskZoneMeta[loan.riskZone].background, border: 'none', flexShrink: 0 }}
                            >
                              {loan.riskZone === 'LIQUIDATION_PLANNING' ? 'Liquidation' : loan.riskZone}
                            </Tag>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                ) : (
                  <div style={{ height: '100%', minHeight: '210px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                    <Radar size={34} />
                    <Text type="secondary">{EMPTY_ANALYTICS_TEXT}</Text>
                    {analyticsError && (
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {BACKEND_ERROR_TEXT}
                      </Text>
                    )}
                  </div>
                )}
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--secondary-color)' }} />
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>Repayment Calendar</span>
                </span>
                {analyticsLoading && <Tag color="processing" style={{ margin: 0 }}>Syncing</Tag>}
              </div>
            }
            style={{ border: '1px solid var(--border-color)', borderRadius: '12px', height: '100%', boxShadow: 'var(--shadow-sm)' }}
            styles={{ body: { padding: '18px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!hasBackendAnalyticsData ? (
                <div style={{ padding: '62px 0', textAlign: 'center' }}>
                  <Calendar size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
                  <Text type="secondary" style={{ display: 'block', fontSize: '13px' }}>{EMPTY_ANALYTICS_TEXT}</Text>
                  {analyticsError && (
                    <Text type="secondary" style={{ display: 'block', marginTop: '6px', fontSize: '11px' }}>
                      {BACKEND_ERROR_TEXT}
                    </Text>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {(dashboardAnalytics?.repaymentCalendar.buckets ?? []).slice(0, 4).map((bucket) => (
                      <div
                        key={bucket.key}
                        style={{
                          background: maturityMeta[bucket.key].background,
                          borderRadius: '8px',
                          padding: '10px',
                          minHeight: '70px',
                        }}
                      >
                        <Text style={{ display: 'block', color: maturityMeta[bucket.key].color, fontSize: '11px', fontWeight: 700 }}>
                          {bucket.label}
                        </Text>
                        <Text strong style={{ display: 'block', fontSize: '18px', lineHeight: 1.2 }}>{bucket.loanCount}</Text>
                        <Text type="secondary" style={{ fontSize: '11px' }}>{formatCurrency(bucket.debtAmount, 'USDC')}</Text>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                    <Text type="secondary" style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Next Repayments
                    </Text>
                    {dashboardSyncLabel && <Text type="secondary" style={{ fontSize: '11px' }}>Updated {dashboardSyncLabel}</Text>}
                  </div>

                  {maturityItems.length === 0 ? (
                    <div style={{ padding: '28px 0', textAlign: 'center' }}>
                      <ShieldCheck size={30} style={{ color: 'var(--success-color)', marginBottom: '8px' }} />
                      <Text type="secondary" style={{ display: 'block', fontSize: '13px' }}>{EMPTY_ANALYTICS_TEXT}</Text>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '270px', overflowY: 'auto', paddingRight: '2px' }}>
                      {maturityItems.map((item) => {
                        const dueLabel = item.bucket === 'defaulted'
                          ? `${item.daysPastDue}d past due`
                          : item.bucket === 'grace'
                            ? `${item.daysPastDue}d in grace`
                            : `${Math.max(0, item.daysUntilDue)}d left`;

                        return (
                          <div
                            key={item.id}
                            style={{
                              border: '1px solid var(--border-light)',
                              borderRadius: '8px',
                              padding: '11px 10px',
                              display: 'grid',
                              gridTemplateColumns: '1fr auto',
                              gap: '10px',
                              alignItems: 'center',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                                <Tag
                                  style={{
                                    margin: 0,
                                    border: 'none',
                                    color: maturityMeta[item.bucket].color,
                                    background: maturityMeta[item.bucket].background,
                                  }}
                                >
                                  {dueLabel}
                                </Tag>
                                <Text strong style={{ fontSize: '13px' }}>{formatCurrency(item.outstandingDebt, item.loanAsset)}</Text>
                              </div>
                              <Text type="secondary" style={{ display: 'block', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {new Date(item.dueTime).toLocaleDateString()} - {item.recommendedAction}
                              </Text>
                            </div>
                            <Button
                              type="text"
                              size="small"
                              aria-label="Open loan detail"
                              icon={<ChevronRight size={16} />}
                              onClick={() => navigate(`/app/loans/${item.id}`)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 4. Active Portfolio Positions & Real-time Activities */}
      <Row gutter={[24, 24]}>
        {/* Left Column: My Active Positions List */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>My Active Portfolio</span>
                {wallet.connected && <Tag color="blue">{myActiveLoansCount} Positions</Tag>}
              </div>
            }
            style={{ border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '380px', boxShadow: 'var(--shadow-sm)' }}
          >
            {!wallet.connected ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Wallet size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <Paragraph type="secondary">Connect your wallet to see your loans and offers.</Paragraph>
                <Button type="primary" onClick={() => navigate('/connect')} style={{ marginTop: '8px' }}>
                  Connect Wallet
                </Button>
              </div>
            ) : myActiveLoansCount === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Layers size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <Paragraph type="secondary">You don't have any active borrowing or lending positions.</Paragraph>
                <Button type="primary" onClick={() => navigate('/app/marketplace')} style={{ marginTop: '8px' }}>
                  Explore Marketplace
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myBorrowedLoans.map((loan) => (
                  <div
                    key={loan.id}
                    onClick={() => navigate(`/app/loans/${loan.id}`)}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    className="hover-card-border"
                  >
                    <div>
                      <Space>
                        <Tag color="red">Borrow</Tag>
                        <Text strong style={{ fontSize: '14px' }}>${loan.amount.toLocaleString()} USDC</Text>
                      </Space>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Collateral: {loan.collateralAmount.toLocaleString()} XLM | APR: {loan.apr}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Health Factor</Text>
                      {renderHF(loan.healthFactor)}
                    </div>
                  </div>
                ))}

                {myLentLoans.map((loan) => (
                  <div
                    key={loan.id}
                    onClick={() => navigate(`/app/loans/${loan.id}`)}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    className="hover-card-border"
                  >
                    <div>
                      <Space>
                        <Tag color="green">Lend</Tag>
                        <Text strong style={{ fontSize: '14px' }}>${loan.amount.toLocaleString()} USDC</Text>
                      </Space>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Collateral: {loan.collateralAmount.toLocaleString()} XLM | APR: {loan.apr}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>Term</Text>
                      <Text strong style={{ fontSize: '13px' }}>{loan.duration} Days</Text>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* Right Column: Ledger Activities */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>My Ledger Feed</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <Activity size={12} className="animate-pulse" style={{ color: 'var(--primary-color)' }} /> Real-time
                </span>
              </div>
            }
            style={{ border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}
            styles={{ body: { padding: '8px 16px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0', maxHeight: '350px', overflowY: 'auto' }}>
              {walletActivities.length === 0 ? (
                <div style={{ padding: '36px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No wallet-specific ledger activity.
                </div>
              ) : walletActivities.slice(0, 5).map((act, index) => (
                <div key={index} style={{ display: 'flex', gap: '12px', paddingBottom: '12px', borderBottom: index < 4 ? '1px solid var(--border-light)' : 'none' }}>
                  <div style={{
                    backgroundColor: 'var(--border-light)',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {act.type.includes('REPAY') || act.type.includes('LIQUIDATE') ? (
                      <ArrowDownLeft size={16} style={{ color: 'var(--success-color)' }} />
                    ) : act.type.includes('BORROW') || act.type.includes('ACCEPT') ? (
                      <ArrowUpRight size={16} style={{ color: 'var(--primary-color)' }} />
                    ) : (
                      <Activity size={16} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                  <div style={{ width: '100%', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Text strong style={{ fontSize: '13px' }}>{act.type.replace(/_/g, ' ')}</Text>
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {act.details}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Render the Swap Modal */}
      <SwapModal open={swapModalOpen} onCancel={() => setSwapModalOpen(false)} />
    </div>
  );
};
