import React, { useState } from 'react';
import { useAppContext } from '../app/AppContext';
import type { OracleImpact } from '../contexts/LendingContext';
import { ADMIN_WALLET_ADDRESS, isAdminWallet } from '../config/admin';
import { calculateHealthFactor, getRiskZone, isOpenLoanStatus } from '../utils/finance';
import { RiskBadge } from '../components/common/RiskBadge';
import { EmptyState } from '../components/common/CommonStates';
import { CONTRACTS } from '../services/soroban/config';
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
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const OracleMonitorPage: React.FC = () => {
  const { oraclePrices, loans, updateOraclePrice, wallet, transactions } = useAppContext();
  const [form] = Form.useForm();

  const xlmPriceInfo = oraclePrices.find((p) => p.asset === 'XLM');
  const xlmPrice = xlmPriceInfo?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;
  const isCurrentWalletAdmin = isAdminWallet(wallet.address);

  // Input state for new price
  const [newPrice, setNewPrice] = useState<number>(xlmPrice);
  const [lastImpacts, setLastImpacts] = useState<OracleImpact[]>([]);

  const activeLoans = loans.filter((l) => isOpenLoanStatus(l.status));

  // Find latest update oracle price transaction
  const lastUpdateTx = transactions.find((tx) => tx.type === 'UPDATE_ORACLE');

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
      title: 'Loan',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ fontFamily: 'var(--font-mono)' }}>#{text}</Text>,
    },
    {
      title: 'Old HF',
      dataIndex: 'oldHF',
      key: 'oldHF',
      render: (hf: number) => <Text strong>{hf.toFixed(2)}</Text>,
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
      title: 'Old Risk',
      dataIndex: 'oldRisk',
      key: 'oldRisk',
      render: (risk: any) => <RiskBadge zone={risk} />,
    },
    {
      title: 'New Risk',
      dataIndex: 'newRisk',
      key: 'newRisk',
      render: (risk: any) => <RiskBadge zone={risk} />,
    },
    {
      title: 'Status after backend recalc',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'Warning') color = 'orange';
        if (status === 'LiquidationPlanning') color = 'red';
        if (status === 'Active') color = 'green';
        return <Tag color={color} style={{ fontWeight: 600 }}>{status}</Tag>;
      },
    },
  ];

  if (oraclePrices.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '28px', letterSpacing: '-0.03em' }}>
            Oracle Monitor
          </Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
            Oracle price feeds are currently offline or unavailable.
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
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '28px', letterSpacing: '-0.03em' }}>
          Oracle Monitor
        </Title>
        <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
          <Text strong>Current Pair:</Text> XLM/USDC | <Text strong>Oracle Contract:</Text> <span style={{ fontFamily: 'var(--font-mono)' }}>{CONTRACTS.oracle}</span> | <Text strong>Admin:</Text> <Tag color={isCurrentWalletAdmin ? 'success' : 'warning'}>{isCurrentWalletAdmin ? 'Authorized' : 'Restricted'}</Tag>
          <Text copyable={{ text: ADMIN_WALLET_ADDRESS }} style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{ADMIN_WALLET_ADDRESS.slice(0, 6)}...{ADMIN_WALLET_ADDRESS.slice(-6)}</Text>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Side: Price Status */}
        <Col xs={24} lg={12}>
          <Card title="Price Status" style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF', height: '100%' }} styles={{ body: { padding: '24px' } }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Current Price
                </Text>
                <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-heading)', marginTop: '4px' }}>
                  ${xlmPrice.toFixed(7)} USDC
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Decimals
                  </Text>
                  <Text strong style={{ fontSize: '16px' }}>7</Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Stale
                  </Text>
                  <Tag color="success" style={{ fontWeight: 600 }}>No</Tag>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Last Updated
                </Text>
                <Text style={{ fontSize: '14px' }}>{xlmPriceInfo ? new Date(xlmPriceInfo.lastUpdated).toLocaleString() : 'N/A'}</Text>
              </div>
            </div>
          </Card>
        </Col>

        {/* Right Side: Admin Update */}
        <Col xs={24} lg={12}>
          <Card title="Admin Update" style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF', height: '100%' }} styles={{ body: { padding: '24px' } }}>
            <Form form={form} layout="vertical" initialValues={{ price: xlmPrice, decimals: 7, source: 'Nexus Admin' }}>
              <Form.Item
                label="New Price (USDC)"
                name="price"
                rules={[{ required: true, message: 'Please enter a price' }]}
              >
                <InputNumber
                  min={0.01}
                  max={1.0}
                  step={0.001}
                  style={{ width: '100%' }}
                  onChange={(val) => {
                    setNewPrice(val || 0);
                    setLastImpacts([]);
                  }}
                />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Form.Item label="Decimals" name="decimals">
                  <InputNumber style={{ width: '100%' }} disabled />
                </Form.Item>
                <Form.Item label="Source" name="source">
                  <span style={{ display: 'block', padding: '5px 12px', background: 'var(--border-light)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
                    Nexus Admin
                  </span>
                </Form.Item>
              </div>

              <Button
                type="primary"
                onClick={handleUpdatePrice}
                disabled={newPrice <= 0 || !isCurrentWalletAdmin}
                style={{ width: '100%', height: '40px', marginTop: '8px' }}
              >
                Update Oracle Price
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* Transaction Receipt */}
      {lastUpdateTx && (
        <Card title="Transaction Receipt" style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Method Called</Text>
              <Text strong style={{ fontFamily: 'var(--font-mono)' }}>set_price_for_assets</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Transaction Hash</Text>
              <Text style={{ fontFamily: 'var(--font-mono)' }} copyable>
                {lastUpdateTx.txHash}
              </Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Ledger</Text>
              <Text strong>{lastUpdateTx.ledger ?? 'Confirmed'}</Text>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>Explorer</Text>
              <div>
                <a href={lastUpdateTx.explorerUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                  View on Stellar Expert &rarr;
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Affected Loans Table */}
      <Card title="Affected Loans Preview" style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }} styles={{ body: { padding: 0 } }}>
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

