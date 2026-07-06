import React, { useState } from 'react';
import { useAppContext } from '../app/AppContext';
import type { OracleImpact } from '../contexts/LendingContext';
import { calculateHealthFactor, getRiskZone, isOpenLoanStatus } from '../utils/finance';
import { RiskBadge } from '../components/common/RiskBadge';
import { EmptyState } from '../components/common/CommonStates';
import {
  Card,
  Row,
  Col,
  Form,
  InputNumber,
  Button,
  Table,
  Typography,
  Tag,
  Space,
} from 'antd';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { generateXlmPriceHistory } from '../data/mockOracle';

const { Title, Paragraph, Text } = Typography;

export const OracleMonitorPage: React.FC = () => {
  const { oraclePrices, loans, updateOraclePrice } = useAppContext();
  const [form] = Form.useForm();

  const xlmPriceInfo = oraclePrices.find((p) => p.asset === 'XLM');
  const xlmPrice = xlmPriceInfo?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

  // Chart data
  const [chartData] = useState(() => generateXlmPriceHistory());

  // Input state for new price
  const [newPrice, setNewPrice] = useState<number>(xlmPrice);
  const [lastImpacts, setLastImpacts] = useState<OracleImpact[]>([]);

  const activeLoans = loans.filter((l) => isOpenLoanStatus(l.status));

  // Preview what loans would look like under the new price
  const previewLoansData = activeLoans.map((loan) => {
    const oldHF = loan.healthFactor;
    const oldRisk = getRiskZone(oldHF);

    const newHF = calculateHealthFactor(
      loan.collateralAmount,
      newPrice,
      loan.outstandingDebt,
      usdcPrice,
      loan.liquidationThreshold
    );
    const newRisk = getRiskZone(newHF);

    return {
      key: loan.id,
      id: loan.id,
      borrower: loan.borrower,
      collateral: loan.collateralAmount,
      debt: loan.outstandingDebt,
      oldHF,
      newHF,
      oldRisk,
      newRisk,
      status: loan.status,
    };
  });

  const lastImpactData = lastImpacts.map((impact) => {
    const loan = loans.find((item) => item.id === impact.loanId);
    return {
      key: impact.loanId,
      id: impact.loanId,
      borrower: loan?.borrower ?? 'Unknown',
      collateral: loan?.collateralAmount ?? 0,
      debt: loan?.outstandingDebt ?? 0,
      oldHF: impact.oldHF,
      newHF: impact.newHF,
      oldRisk: getRiskZone(impact.oldHF),
      newRisk: getRiskZone(impact.newHF),
      status: impact.newStatus,
    };
  });

  const affectedLoansData = lastImpacts.length > 0 ? lastImpactData : previewLoansData;

  const handleUpdatePrice = async () => {
    const impacts = await updateOraclePrice(newPrice);
    setLastImpacts(impacts);
  };

  const columns = [
    {
      title: 'Contract ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{text}</Text>,
    },
    {
      title: 'Borrower',
      dataIndex: 'borrower',
      key: 'borrower',
      render: (text: string) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{text.slice(0, 6)}...{text.slice(-6)}</Text>,
    },
    {
      title: 'Debt / Collateral',
      key: 'debtCollateral',
      render: (_: any, record: any) => (
        <span>
          ${record.debt.toLocaleString()} / {record.collateral.toLocaleString()} XLM
        </span>
      ),
    },
    {
      title: 'Old HF',
      dataIndex: 'oldHF',
      key: 'oldHF',
      render: (hf: number) => (
        <Space>
          <Text strong>{hf.toFixed(2)}</Text>
        </Space>
      ),
    },
    {
      title: 'Old Risk',
      dataIndex: 'oldRisk',
      key: 'oldRisk',
      render: (risk: any) => <RiskBadge zone={risk} />,
    },
    {
      title: 'New HF',
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
      title: 'New Risk',
      dataIndex: 'newRisk',
      key: 'newRisk',
      render: (risk: any) => <RiskBadge zone={risk} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color="processing">{status}</Tag>,
    },
  ];

  const isPositive = xlmPriceInfo ? xlmPriceInfo.change24h >= 0 : true;

  if (oraclePrices.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Oracle Monitor
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Real-time oracle price feeds and loan health simulation.
          </Paragraph>
        </div>
        <EmptyState
          title="No Oracle Price Available"
          description="Oracle price feeds are currently offline or unavailable."
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div>
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
          Oracle Monitor
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Admin demo control room. Simulate Oracle feed updates to test protocol risk management, loan warning zones, and liquidations.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Side: Simulation form and Price feed */}
        <Col xs={24} lg={10}>
          <Card title="Oracle Price Simulation Controls" styles={{ body: { padding: '24px' } }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-color)',
              padding: '20px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              marginBottom: '24px'
            }}>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  CURRENT ORACLE PRICE
                </Text>
                <Title level={3} style={{ margin: '4px 0 0 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                  ${xlmPrice.toFixed(4)} USDC
                </Title>
              </div>
              <div>
                <Tag color={isPositive ? 'success' : 'error'} style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {xlmPriceInfo?.change24h}% (24h)
                </Tag>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div className="metric-panel">
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  Last Updated
                </Text>
                <Text strong>{xlmPriceInfo ? new Date(xlmPriceInfo.lastUpdated).toLocaleString() : 'N/A'}</Text>
              </div>
              <div className="metric-panel">
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  Price Source
                </Text>
                <Text strong>{xlmPriceInfo?.source || 'N/A'}</Text>
              </div>
            </div>

            <Form form={form} layout="vertical" initialValues={{ price: xlmPrice }}>
              <Form.Item
                label="Simulated XLM Price (USDC)"
                name="price"
                extra="Change this value to simulate market drops (e.g. $0.09) or market recoveries (e.g. $0.16)."
              >
                <InputNumber
                  min={0.01}
                  max={1.0}
                  step={0.005}
                  style={{ width: '100%' }}
                  size="large"
                  onChange={(val) => {
                    setNewPrice(val || 0);
                    setLastImpacts([]);
                  }}
                />
              </Form.Item>

              <Button
                type="primary"
                size="large"
                onClick={handleUpdatePrice}
                disabled={newPrice <= 0}
                icon={<Activity size={18} style={{ marginRight: 6 }} />}
                style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Update Oracle Price
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Right Side: Price Chart */}
        <Col xs={24} lg={14}>
          <Card title="XLM / USDC 30-Day Historical Chart" styles={{ body: { padding: '24px' } }}>
            {chartData.length === 0 ? (
              <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No historical price data available
              </div>
            ) : (
              <div style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#6B7280" style={{ fontSize: '11px' }} />
                    <YAxis
                      stroke="#6B7280"
                      style={{ fontSize: '11px' }}
                      domain={['auto', 'auto']}
                      tickFormatter={(val) => `$${val.toFixed(3)}`}
                    />
                    <ChartTooltip formatter={(val: any) => [`$${parseFloat(val).toFixed(4)}`, 'Price']} />
                    <Line type="monotone" dataKey="price" stroke="var(--primary-color)" strokeWidth={2.5} dot={false} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Affected Contracts Table */}
      <Card title="Recalculation Preview of Active Contracts" styles={{ body: { padding: 0 } }}>
        {activeLoans.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No active loan contracts currently locked on-chain.
          </div>
        ) : (
          <Table columns={columns} dataSource={affectedLoansData} pagination={false} />
        )}
      </Card>
    </div>
  );
};

