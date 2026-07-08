import React, { useState } from 'react';
import { useAppContext } from '../app/AppContext';
import { formatCurrency, isLiquidatable, isOpenLoanStatus } from '../utils/finance';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  AlertTriangle,
  Layers,
  Activity,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  PlusCircle,
  Copy,
  Check,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { SwapModal } from '../components/common/SwapModal';

const { Title, Paragraph, Text } = Typography;

// Mock historical data for premium chart
const mockChartData = [
  { date: '07-02', TVL: 120000, Borrowed: 45000 },
  { date: '07-03', TVL: 135000, Borrowed: 52000 },
  { date: '07-04', TVL: 130000, Borrowed: 58000 },
  { date: '07-05', TVL: 155000, Borrowed: 61000 },
  { date: '07-06', TVL: 172000, Borrowed: 68000 },
  { date: '07-07', TVL: 198000, Borrowed: 74000 },
  { date: '07-08', TVL: 215000, Borrowed: 82000 },
];

export const DashboardPage: React.FC = () => {
  const { loans, loanOffers, oraclePrices, activities, wallet } = useAppContext();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [swapModalOpen, setSwapModalOpen] = useState(false);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

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
  const activeOffers = loanOffers.filter((offer) => offer.status === 'Active');
  const fundedOffers = loanOffers.filter((offer) => ['Funding', 'Active'].includes(offer.status ?? 'Draft'));
  const activeLoansCount = activeLoansList.length;

  const totalBorrowedVal = activeLoansList.reduce((sum, l) => sum + l.amount, 0);
  const totalCollateralLockedXLM = activeLoansList.reduce((sum, l) => sum + l.collateralAmount, 0);
  const totalCollateralLockedVal = totalCollateralLockedXLM * xlmPrice;

  // TVL = Collateral locked + USDC funds remaining in offers
  const totalOffersVal = fundedOffers.reduce((sum, o) => sum + o.amount, 0);
  const tvl = totalCollateralLockedVal + totalOffersVal;

  // Average Health Factor
  const avgHF =
    activeLoansCount > 0
      ? activeLoansList.reduce((sum, l) => sum + l.healthFactor, 0) / activeLoansCount
      : 99.99;

  // Liquidatable Loans
  const liquidatableCount = activeLoansList.filter((l) => isLiquidatable(l.healthFactor, l.status)).length;

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

      {/* 3. Analytics Chart & Protocol Health Overview */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Liquidity & Debt Velocity</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Historical Testnet Activity</span>
              </div>
            }
            style={{ border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}
            styles={{ body: { padding: '16px 20px 24px 20px' } }}
          >
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer>
                <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTVL" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorBorrowed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--secondary-color)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--secondary-color)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <ChartTooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 700 }}
                  />
                  <Area type="monotone" dataKey="TVL" stroke="var(--primary-color)" strokeWidth={2} fillOpacity={1} fill="url(#colorTVL)" name="TVL" />
                  <Area type="monotone" dataKey="Borrowed" stroke="var(--secondary-color)" strokeWidth={2} fillOpacity={1} fill="url(#colorBorrowed)" name="Borrowed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--success-color)' }} />
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Protocol Risk Parameters</span>
              </div>
            }
            style={{ border: '1px solid var(--border-color)', borderRadius: '12px', height: '100%', boxShadow: 'var(--shadow-sm)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: '13px' }}>Avg Protocol Health Factor</Text>
                <Text strong style={{ fontSize: '14px' }}>
                  {avgHF >= 99.0 ? '100% Safe' : avgHF.toFixed(2)}
                </Text>
              </div>
              <Progress percent={avgHF >= 99.0 ? 100 : Math.min(100, (avgHF / 3) * 100)} showInfo={false} strokeColor="var(--success-color)" />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <Text type="secondary" style={{ fontSize: '13px' }}>Active Offers Available</Text>
                <Text strong style={{ fontSize: '14px' }}>{activeOffers.length} Active</Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <Text type="secondary" style={{ fontSize: '13px' }}>Stressed / Liquidation Risk</Text>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {liquidatableCount > 0 ? (
                    <>
                      <AlertTriangle size={14} style={{ color: 'var(--danger-color)' }} />
                      <Text strong style={{ color: 'var(--danger-color)' }}>{liquidatableCount} Loans</Text>
                    </>
                  ) : (
                    <Text strong style={{ color: 'var(--success-color)' }}>0 Positions</Text>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <Text type="secondary" style={{ fontSize: '13px' }}>Total Collateral Deposited</Text>
                <Text strong style={{ fontSize: '14px' }}>{totalCollateralLockedXLM.toLocaleString()} XLM</Text>
              </div>
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
                <span style={{ fontSize: '15px', fontWeight: 700 }}>Stellar Ledger Feed</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <Activity size={12} className="animate-pulse" style={{ color: 'var(--primary-color)' }} /> Real-time
                </span>
              </div>
            }
            style={{ border: '1px solid var(--border-color)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}
            styles={{ body: { padding: '8px 16px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0', maxHeight: '350px', overflowY: 'auto' }}>
              {activities.slice(0, 5).map((act, index) => (
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
