import React from 'react';
import { useAppContext } from '../app/AppContext';
import { formatCurrency, isLiquidatable, isOpenLoanStatus } from '../utils/finance';
import { StatisticCard } from '../components/common/StatisticCard';
import { OraclePriceWidget } from '../components/common/OraclePriceWidget';
import {
  Card,
  Col,
  Row,
  Table,
  Typography,
  Tag,
} from 'antd';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import {
  Coins,
  FileBadge2,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Activity,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const DashboardPage: React.FC = () => {
  const { loans, loanOffers, oraclePrices, activities } = useAppContext();

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // 1. Dynamic Metric Calculations
  const openLoansList = loans.filter((l) => isOpenLoanStatus(l.status));
  const activeLoansList = openLoansList.filter((l) => l.status !== 'PendingCollateral');
  const activeOffers = loanOffers.filter((offer) => offer.status === 'Active');
  const fundedOffers = loanOffers.filter((offer) => ['Funding', 'Active'].includes(offer.status ?? 'Draft'));
  const activeLoansCount = activeLoansList.length;
  const totalOffersCount = loanOffers.length;

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

  const interestEarned = loans.filter((l) => l.status === 'Repaid').reduce((sum, l) => {
    const interest = l.amount * (l.apr / 100) * (l.duration / 365);
    return sum + interest;
  }, 0);

  // 2. Charts Data Setup
  // TVL History Mock Data
  const tvlHistoryData = [
    { name: 'Week 1', TVL: tvl * 0.8 },
    { name: 'Week 2', TVL: tvl * 0.85 },
    { name: 'Week 3', TVL: tvl * 0.92 },
    { name: 'Week 4', TVL: tvl * 0.97 },
    { name: 'Week 5', TVL: tvl },
  ];

  // Loan Status Data
  const statusPieData = [
    { name: 'Safe Loans', value: activeLoansList.filter((l) => l.status === 'Active').length, color: '#2F80ED' },
    { name: 'Warning Loans', value: activeLoansList.filter((l) => l.status === 'Warning').length, color: '#F2994A' },
    { name: 'Liquidation Planning', value: activeLoansList.filter((l) => isLiquidatable(l.healthFactor, l.status)).length, color: '#EB5757' },
    { name: 'Pending Collateral', value: openLoansList.filter((l) => l.status === 'PendingCollateral').length, color: '#F2C94C' },
    { name: 'Active Offers', value: activeOffers.length, color: '#F2C94C' },
    { name: 'Repaid', value: loans.filter((l) => l.status === 'Repaid' || l.status === 'Closed').length, color: '#27AE60' },
    { name: 'Liquidated', value: loans.filter((l) => l.status === 'Liquidated').length, color: '#EB5757' },
  ].filter((item) => item.value > 0);

  // Health Factor distribution ranges
  const hfRanges = [
    { range: 'Liquidatable (<1.2)', count: activeLoansList.filter((l) => l.healthFactor < 1.2).length, color: '#EB5757' },
    { range: 'Warning (1.2-1.4)', count: activeLoansList.filter((l) => l.healthFactor >= 1.2 && l.healthFactor < 1.4).length, color: '#F2994A' },
    { range: 'Safe (>=1.4)', count: activeLoansList.filter((l) => l.healthFactor >= 1.4).length, color: '#27AE60' },
  ];

  // 3. Activity Table Configuration
  const activityColumns = [
    {
      title: 'Action',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => {
        const colorMap: Record<string, string> = {
          CONNECT_WALLET: 'purple',
          CREATE_OFFER: 'gold',
          FUND_OFFER: 'gold',
          ACTIVATE_OFFER: 'green',
          CANCEL_OFFER: 'default',
          EXPIRE_OFFER: 'default',
          ACCEPT_OFFER: 'blue',
          ACTIVATE_LOAN: 'cyan',
          BORROW_LOAN: 'blue',
          BORROW: 'blue',
          ADD_COLLATERAL: 'cyan',
          PARTIAL_REPAY: 'green',
          FULL_REPAY: 'green',
          REPAY: 'green',
          UPDATE_ORACLE: 'magenta',
          LIQUIDATE: 'red',
          CLAIM_REPAYMENT: 'lime',
        };

        return <Tag color={colorMap[text] ?? 'default'} style={{ fontWeight: 600 }}>{text.replace(/_/g, ' ')}</Tag>;
      },
    },
    {
      title: 'User Address',
      dataIndex: 'user',
      key: 'user',
      render: (text: string) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{text.slice(0, 6)}...{text.slice(-6)}</Text>,
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
    },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => new Date(text).toLocaleString(),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Nexus Dashboard
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Global statistics and live telemetry of the Nexus Lending protocol.
          </Paragraph>
        </div>
        <div style={{ width: '320px' }}>
          <OraclePriceWidget />
        </div>
      </div>

      {/* Statistics Grid */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Total Value Locked (TVL)"
            value={formatCurrency(tvl, 'USDC')}
            icon={<Coins size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Total Borrowed"
            value={formatCurrency(totalBorrowedVal, 'USDC')}
            icon={<FileBadge2 size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Collateral Locked"
            value={`${totalCollateralLockedXLM.toLocaleString()} XLM`}
            icon={<ShieldCheck size={22} />}
            trend={{ value: '($' + formatCurrency(totalCollateralLockedVal, 'USDC').slice(1) + ')', isPositive: true }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Average Health Factor"
            value={avgHF >= 99.0 ? 'N/A' : avgHF.toFixed(2)}
            icon={<TrendingUp size={22} />}
          />
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Total Loan Offers"
            value={totalOffersCount}
            icon={<Layers size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Active Loans"
            value={activeLoansCount}
            icon={<Activity size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Interest Earned"
            value={formatCurrency(interestEarned, 'USDC')}
            icon={<TrendingUp size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ position: 'relative' }}>
            <StatisticCard
              title="Liquidatable Loans"
              value={liquidatableCount}
              icon={<AlertTriangle size={22} style={{ color: liquidatableCount > 0 ? 'var(--danger-color)' : 'var(--text-muted)' }} />}
            />
            {liquidatableCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '10px',
                height: '10px',
                backgroundColor: 'var(--danger-color)',
                borderRadius: '50%',
                display: 'inline-block'
              }} className="pulse-animation"></span>
            )}
          </div>
        </Col>
      </Row>

      {/* Charts Section */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Total Value Locked (TVL) Growth" styles={{ body: { padding: '24px' } }}>
            {tvl === 0 ? (
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No locked value or historical data available
              </div>
            ) : (
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tvlHistoryData}>
                    <defs>
                      <linearGradient id="colorTvl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2F80ED" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2F80ED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" stroke="#6B7280" style={{ fontSize: '12px' }} />
                    <YAxis
                      stroke="#6B7280"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip formatter={(val: any) => [`$${parseFloat(val).toFixed(2)}`, 'TVL']} />
                    <Area type="monotone" dataKey="TVL" stroke="#2F80ED" strokeWidth={2} fillOpacity={1} fill="url(#colorTvl)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card title="Loan Distribution" styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' } }}>
            {statusPieData.length === 0 ? (
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                No active loans or offers
              </div>
            ) : (
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
                {/* Custom Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px', marginTop: '-30px' }}>
                  {statusPieData.map((item, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }}></span>
                      <Text type="secondary">{item.name} ({item.value})</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card title="Health Factor Risk Zone" styles={{ body: { padding: '24px' } }}>
            {activeLoansCount === 0 ? (
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No active loans
              </div>
            ) : (
              <div style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hfRanges} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" stroke="#6B7280" style={{ fontSize: '12px' }} allowDecimals={false} />
                    <YAxis dataKey="range" type="category" stroke="#6B7280" style={{ fontSize: '11px' }} width={120} />
                    <ChartTooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {hfRanges.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Activity Table */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Recent Activities</span>
            <Text type="secondary" style={{ fontSize: '13px', fontWeight: 'normal' }}>
              Real-time Stellar Ledger Logs
            </Text>
          </div>
        }
        styles={{ body: { padding: '0px' } }}
      >
        <Table
          columns={activityColumns}
          dataSource={activities.slice(0, 6).map((item, index) => ({ ...item, key: index }))}
          pagination={false}
        />
      </Card>
    </div>
  );
};

