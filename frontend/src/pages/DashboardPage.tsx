import React from 'react';
import { useAppContext } from '../app/AppContext';
import { formatCurrency, isLiquidatable, isOpenLoanStatus } from '../utils/finance';
import { StatisticCard } from '../components/common/StatisticCard';
import { OraclePriceWidget } from '../components/common/OraclePriceWidget';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Col,
  Row,
  Table,
  Typography,
  Tag,
  Button,
  Alert,
} from 'antd';
import {
  Coins,
  FileBadge2,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Activity,
  ExternalLink,
  Wallet,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const DashboardPage: React.FC = () => {
  const { loans, loanOffers, oraclePrices, activities, wallet } = useAppContext();
  const navigate = useNavigate();

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

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
        };

        return <Tag color={colorMap[text] ?? 'default'} style={{ fontWeight: 700, borderRadius: '4px' }}>{text.replace(/_/g, ' ')}</Tag>;
      },
    },
    {
      title: 'User Address',
      dataIndex: 'user',
      key: 'user',
      render: (text: string) => <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{text.slice(0, 6)}...{text.slice(-6)}</Text>,
    },
    {
      title: 'Transaction Hash',
      dataIndex: 'txHash',
      key: 'txHash',
      render: (hash: string, record: any) => {
        if (!hash) return <Text type="secondary">-</Text>;
        return (
          <a href={record.explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {hash.slice(0, 6)}...{hash.slice(-6)} <ExternalLink size={12} />
          </a>
        );
      },
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (text: string) => <Text style={{ fontSize: '13px' }}>{text}</Text>
    },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(text).toLocaleString()}</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '28px', letterSpacing: '-0.03em' }}>
            Nexus Protocol Telemetry
          </Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
            Real-time analytics and liquidity parameters from Stellar Testnet.
          </Paragraph>
        </div>
        <div style={{ width: '320px' }}>
          <OraclePriceWidget />
        </div>
      </div>

      {/* Section A: My Portfolio */}
      <div>
        <Title level={4} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
          <Wallet size={18} style={{ color: 'var(--primary-color)' }} /> Section A: My Portfolio
        </Title>
        {!wallet.connected ? (
          <Alert
            message="Wallet Disconnected"
            description={
              <div>
                Connect your Freighter wallet to view your active lending allocations, borrowed capital, and collateral health factor.
                <div style={{ marginTop: '12px' }}>
                  <Button type="primary" onClick={() => navigate('/connect')}>Connect Wallet</Button>
                </div>
              </div>
            }
            type="warning"
            showIcon
          />
        ) : (
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
              <StatisticCard
                title="My Lent Capital"
                value={formatCurrency(myLentAmount, 'USDC')}
                icon={<Coins size={16} />}
              />
            </Col>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
              <StatisticCard
                title="My Borrowed Debt"
                value={formatCurrency(myBorrowedAmount, 'USDC')}
                icon={<FileBadge2 size={16} />}
              />
            </Col>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
              <StatisticCard
                title="My Locked Collateral"
                value={`${myCollateralLockedXLM.toLocaleString()} XLM`}
                icon={<ShieldCheck size={16} />}
                trend={{ value: '($' + myCollateralLockedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ')', isPositive: true }}
              />
            </Col>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
              <StatisticCard
                title="My Average HF"
                value={myAvgHF > 0 ? myAvgHF.toFixed(2) : 'N/A'}
                icon={<TrendingUp size={16} />}
              />
            </Col>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
              <StatisticCard
                title="My Active Positions"
                value={myActiveLoansCount}
                icon={<Activity size={16} />}
              />
            </Col>
          </Row>
        )}
      </div>

      {/* Section B: Protocol Health */}
      <div>
        <Title level={4} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
          <ShieldCheck size={18} style={{ color: 'var(--success-color)' }} /> Section B: Protocol Health
        </Title>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
            <StatisticCard
              title="Protocol TVL"
              value={formatCurrency(tvl, 'USDC')}
              icon={<Coins size={16} />}
            />
          </Col>
          <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
            <StatisticCard
              title="Active Borrowed"
              value={formatCurrency(totalBorrowedVal, 'USDC')}
              icon={<FileBadge2 size={16} />}
            />
          </Col>
          <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
            <StatisticCard
              title="Active Offers"
              value={activeOffers.length}
              icon={<Layers size={16} />}
              trend={{ value: `(${totalOffersCount} Total)`, isPositive: true }}
            />
          </Col>
          <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
            <StatisticCard
              title="Stressed HF Position"
              value={liquidatableCount}
              icon={<AlertTriangle size={16} style={{ color: liquidatableCount > 0 ? 'var(--danger-color)' : 'var(--text-muted)' }} />}
            />
          </Col>
          <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 0 18%' }}>
            <StatisticCard
              title="Avg Protocol HF"
              value={avgHF >= 99.0 ? 'N/A' : avgHF.toFixed(2)}
              icon={<TrendingUp size={16} />}
            />
          </Col>
        </Row>
      </div>

      {/* Section C: Blockchain Activity */}
      <div>
        <Title level={4} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontFamily: 'var(--font-heading)' }}>
          <Activity size={18} style={{ color: 'var(--primary-color)' }} /> Section C: Blockchain Activity
        </Title>
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Recent System Transactions</span>
              <Text type="secondary" style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                Real-time Stellar Ledger Logs
              </Text>
            </div>
          }
          styles={{ body: { padding: '0px' } }}
          style={{ border: '1px solid var(--border-color)' }}
        >
          <Table
            columns={activityColumns}
            dataSource={activities.slice(0, 8).map((item, index) => ({ ...item, key: index }))}
            pagination={false}
          />
        </Card>
      </div>
    </div>
  );
};
