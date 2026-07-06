import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateRequiredCollateral, calculateRepaymentAmount, calculateHealthFactor, calculateLTV, formatCurrency } from '../utils/finance';
import { HealthFactorGauge } from '../components/common/HealthFactorGauge';
import { EmptyState } from '../components/common/CommonStates';
import { ConfirmActionModal } from '../components/common/ConfirmActionModal';
import {
  Card,
  Row,
  Col,
  Form,
  InputNumber,
  Button,
  Typography,
  Alert,
  Select,
} from 'antd';
import { Wallet, Info, ChevronLeft } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

export const BorrowLoanPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loanOffers, oraclePrices, wallet, acceptOffer } = useAppContext();
  const [form] = Form.useForm();

  const offer = loanOffers.find((o) => o.id === id && o.status === 'Active');

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

  // Minimum required collateral based on Max LTV
  const minRequiredXLM = offer
    ? calculateRequiredCollateral(offer.amount, 1.0, xlmPrice, offer.maxLTV)
    : 0;

  // State for user-defined collateral deposit amount (defaults to min required)
  const [collateralAmount, setCollateralAmount] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (minRequiredXLM) {
      setCollateralAmount(Math.ceil(minRequiredXLM));
      form.setFieldsValue({ collateral: Math.ceil(minRequiredXLM) });
    }
  }, [minRequiredXLM, form]);

  if (!offer) {
    return (
      <EmptyState
        title="Lending Offer Not Found"
        description="This offer might have been filled by another borrower or cancelled by the lender."
        action={
          <Button type="primary" onClick={() => navigate('/app/marketplace')}>
            Back to Marketplace
          </Button>
        }
      />
    );
  }

  const repaymentAmt = calculateRepaymentAmount(offer.amount, offer.apr, offer.duration);

  // Live simulation values
  const collateralValue = collateralAmount * xlmPrice;
  const currentLTV = calculateLTV(collateralAmount, xlmPrice, repaymentAmt, usdcPrice);
  const healthFactor = calculateHealthFactor(
    collateralAmount,
    xlmPrice,
    repaymentAmt,
    usdcPrice,
    offer.liquidationThreshold
  );

  const canBorrow = healthFactor >= offer.minHealthFactor && wallet.balanceXLM >= collateralAmount;

  const handleBorrowSubmit = () => {
    form.validateFields().then(() => {
      setModalVisible(true);
    });
  };

  const handleConfirmBorrow = async () => {
    const loan = await acceptOffer(offer.id, collateralAmount);
    if (!loan) {
      throw new Error('Borrow transaction failed');
    }
    setModalVisible(false);
    navigate('/app/borrower');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <Button
          type="text"
          icon={<ChevronLeft size={16} />}
          onClick={() => navigate(`/app/loans/${id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)' }}
        >
          Back to Details
        </Button>
        <Title level={2} style={{ margin: '8px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
          Borrow USDC Stablecoin
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Accept an Active lender offer, then activate the PendingCollateral loan to lock XLM and draw USDC principal.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left: Summary */}
        <Col xs={24} md={8}>
          <Card title="Loan Offer Summary" styles={{ body: { padding: '24px' } }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  BORROW PRINCIPAL
                </Text>
                <Text strong style={{ fontSize: '24px', color: 'var(--primary-color)', fontFamily: 'var(--font-heading)' }}>
                  {formatCurrency(offer.amount, 'USDC')}
                </Text>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  INTEREST TERMS
                </Text>
                <Text strong>{offer.apr}% APR (Fixed)</Text>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  DURATION
                </Text>
                <Text strong>{offer.duration} Days</Text>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                  MINIMUM REQUIRED COLLATERAL
                </Text>
                <Text strong style={{ color: '#E28743' }}>
                  {Math.ceil(minRequiredXLM).toLocaleString()} XLM
                </Text>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                  Based on {offer.maxLTV}% Max LTV limit
                </Text>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Liquidation Threshold:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.liquidationThreshold}% LTV</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span>Liquidation Bonus:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.liquidationBonus}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Lender Address:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{offer.lender.slice(0, 4)}...{offer.lender.slice(-4)}</span>
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Center: Form */}
        <Col xs={24} md={8}>
          <Card title="Configure Escrow Deposit" styles={{ body: { padding: '24px' } }}>
            <Form form={form} layout="vertical">
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--bg-color)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={16} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Your XLM Balance:</span>
                </div>
                <Text strong>{wallet.balanceXLM.toLocaleString()} XLM</Text>
              </div>

              <Form.Item label="Collateral Asset" required>
                <Select disabled value="XLM" size="large">
                  <Option value="XLM">XLM (Stellar Lumens)</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Escrow Deposit Amount (XLM)"
                name="collateral"
                rules={[
                  { required: true, message: 'Please enter collateral amount' },
                  {
                    validator: (_, value) => {
                      if (!value || value >= minRequiredXLM) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(`Minimum required is ${Math.ceil(minRequiredXLM)} XLM`));
                    }
                  }
                ]}
              >
                <InputNumber
                  min={Math.ceil(minRequiredXLM)}
                  style={{ width: '100%' }}
                  size="large"
                  onChange={(val) => setCollateralAmount(val || 0)}
                />
              </Form.Item>

              <Form.Item label="Borrow Asset" required>
                <Select disabled value="USDC" size="large">
                  <Option value="USDC">USDC (USD Coin)</Option>
                </Select>
              </Form.Item>

              <Form.Item label="Borrow Amount (USDC)">
                <InputNumber disabled value={offer.amount} style={{ width: '100%' }} size="large" />
              </Form.Item>

              <Button
                type="primary"
                size="large"
                disabled={!canBorrow}
                onClick={handleBorrowSubmit}
                style={{ width: '100%', height: '48px', marginTop: '8px' }}
              >
                Accept Offer
              </Button>
            </Form>
          </Card>
        </Col>

        {/* Right: Simulation Card */}
        <Col xs={24} md={8}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={16} style={{ color: 'var(--primary-color)' }} />
                <span>Borrow Risk Simulator</span>
              </div>
            }
            styles={{ body: { padding: '24px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <HealthFactorGauge value={healthFactor} size={130} showMeaning />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Collateral Value:</Text>
                <Text strong>${collateralValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Current LTV:</Text>
                <Text strong style={{ color: currentLTV > offer.maxLTV ? 'var(--danger-color)' : 'var(--text-main)' }}>
                  {currentLTV.toFixed(2)}%
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Estimated Repayment:</Text>
                <Text strong>${repaymentAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Initial Risk Zone:</Text>
                <Text strong style={{ color: healthFactor < 1.2 ? 'var(--danger-color)' : healthFactor < 1.4 ? 'var(--warning-color)' : 'var(--success-color)' }}>
                  {healthFactor < 1.2 ? 'Liquidation planning' : healthFactor < 1.4 ? 'Warning' : 'Safe'}
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Oracle XLM Price:</Text>
                <Text strong>${xlmPrice.toFixed(4)}</Text>
              </div>
            </div>

            {/* Validation Warnings */}
            {wallet.balanceXLM < collateralAmount ? (
              <Alert
                message="Insufficient Balance"
                description={`You need ${collateralAmount.toLocaleString()} XLM, but your balance is only ${wallet.balanceXLM.toLocaleString()} XLM.`}
                type="error"
                showIcon
              />
            ) : healthFactor < 1.2 ? (
              <Alert
                message="Borrow Blocked"
                description={`Health Factor is too low (${healthFactor}). Add more collateral to reduce risk (HF must be >= ${offer.minHealthFactor.toFixed(2)}).`}
                type="error"
                showIcon
              />
            ) : healthFactor < 1.4 ? (
              <Alert
                message="Borrow Blocked in Warning Zone"
                description={`MVP requires initial Health Factor >= ${offer.minHealthFactor.toFixed(2)}. Increase collateral before borrowing.`}
                type="warning"
                showIcon
              />
            ) : (
              <Alert
                message="Safe Collateralization"
                description="Your Health Factor is in the safe zone (>= 1.4). Your borrow request is fully secured."
                type="success"
                showIcon
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Confirmation Modal */}
      <ConfirmActionModal
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onConfirm={handleConfirmBorrow}
        title="Confirm Borrow Agreement"
        actionText="Accept Offer"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p>You are accepting an isolated lender offer on the Stellar Soroban network.</p>
          <div style={{
            background: 'var(--bg-color)',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '13px'
          }}>
            <div>- <b>USDC Principal Borrowed:</b> ${offer.amount.toLocaleString()}</div>
            <div>- <b>Planned XLM Collateral:</b> {collateralAmount.toLocaleString()} XLM</div>
            <div>- <b>Total Repayment Due:</b> ${repaymentAmt.toLocaleString()} in {offer.duration} days</div>
            <div>- <b>LTV Threshold:</b> {offer.liquidationThreshold}% LTV</div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            * This creates a PendingCollateral loan. Activate it from your borrower dashboard to lock collateral and receive funds.
          </p>
        </div>
      </ConfirmActionModal>
    </div>
  );
};

