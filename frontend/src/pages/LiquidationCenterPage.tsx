import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { formatCurrency, formatAddress, isLiquidatable, isOpenLoanStatus } from '../utils/finance';
import { StatisticCard } from '../components/common/StatisticCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { EmptyState } from '../components/common/CommonStates';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Typography,
  Tag,
} from 'antd';
import {
  Flame,
  AlertTriangle,
  TrendingDown,
  Coins,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const LiquidationCenterPage: React.FC = () => {
  const { loans, oraclePrices } = useAppContext();
  const navigate = useNavigate();

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // Filter loans that satisfy protocol liquidation rules.
  const liquidatableLoans = loans.filter(
    (l) => isOpenLoanStatus(l.status) && isLiquidatable(l.healthFactor, l.status)
  );

  // Statistics
  const count = liquidatableLoans.length;
  const totalDebtAtRisk = liquidatableLoans.reduce((sum, l) => sum + l.outstandingDebt, 0);

  const avgHF =
    count > 0 ? liquidatableLoans.reduce((sum, l) => sum + l.healthFactor, 0) / count : 0;

  // Total liquidation bonus value in USD available to be claimed
  const totalBonusVal = liquidatableLoans.reduce((sum, l) => {
    const debtToLiquidate = l.outstandingDebt * 0.5; // assume 50% partial liquidation
    const bonusVal = debtToLiquidate * (l.liquidationBonus / 100);
    return sum + bonusVal;
  }, 0);

  const columns = [
    {
      title: 'Contract ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{text}</Text>,
    },
    {
      title: 'Borrower Address',
      dataIndex: 'borrower',
      key: 'borrower',
      render: (text: string) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{formatAddress(text)}</Text>,
    },
    {
      title: 'Outstanding Debt',
      dataIndex: 'outstandingDebt',
      key: 'outstandingDebt',
      render: (debt: number, record: any) => <Text strong>{formatCurrency(debt, record.asset)}</Text>,
    },
    {
      title: 'Locked Collateral',
      dataIndex: 'collateralAmount',
      key: 'collateralAmount',
      render: (amount: number, record: any) => (
        <span>
          {amount.toLocaleString()} {record.collateralAsset}
          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
            (${ (amount * xlmPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
          </Text>
        </span>
      ),
    },
    {
      title: 'Health Factor',
      dataIndex: 'healthFactor',
      key: 'healthFactor',
      render: (hf: number) => (
        <Text strong style={{ color: 'var(--danger-color)' }}>
          {hf.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Risk Level',
      key: 'risk',
      render: () => <RiskBadge zone="LIQUIDATION_PLANNING" />,
    },
    {
      title: 'Liquidator Bonus',
      dataIndex: 'liquidationBonus',
      key: 'liquidationBonus',
      render: (bonus: number) => <Tag color="green" style={{ fontWeight: 600 }}>+{bonus}% Collateral</Tag>,
    },
    {
      title: 'Max Repay (50%)',
      key: 'maxRepay',
      render: (_: any, record: any) => (
        <Text strong>{formatCurrency(record.outstandingDebt * 0.5, record.asset)}</Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => navigate(`/app/liquidation/${record.id}`)}>
            Plan Liquidation
          </Button>
          <Button
            type="primary"
            danger
            size="small"
            onClick={() => navigate(`/app/liquidation/${record.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Flame size={12} /> Liquidate
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div>
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
          Liquidation Center
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Liquidate stressed positions (Health Factor &lt; 1.2) to protect lender capital and earn bonus collateral.
        </Paragraph>
      </div>

      {/* Top statistics */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <div style={{ position: 'relative' }}>
            <StatisticCard
              title="Liquidatable Positions"
              value={count}
              icon={<Flame size={22} style={{ color: count > 0 ? 'var(--danger-color)' : 'var(--text-muted)' }} />}
            />
            {count > 0 && (
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
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Total Debt at Risk"
            value={formatCurrency(totalDebtAtRisk, 'USDC')}
            icon={<AlertTriangle size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Est. Arbitrage Profit"
            value={formatCurrency(totalBonusVal, 'USDC')}
            icon={<Coins size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="Average Stressed HF"
            value={count > 0 ? avgHF.toFixed(2) : 'N/A'}
            icon={<TrendingDown size={22} />}
          />
        </Col>
      </Row>

      {/* Liquidatable Table */}
      {count === 0 ? (
        <EmptyState
          title="No Liquidatable Loans"
          description="All positions on the Nexus protocol are currently healthy. Health Factors are above the 1.2 risk line."
        />
      ) : (
        <Card title="Stressed Positions Ledger" styles={{ body: { padding: 0 } }}>
          <Table columns={columns} dataSource={liquidatableLoans.map((item) => ({ ...item, key: item.id }))} pagination={false} />
        </Card>
      )}
    </div>
  );
};

