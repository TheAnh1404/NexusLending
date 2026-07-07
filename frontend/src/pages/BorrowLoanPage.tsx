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
  Tag,
  Divider,
  Steps,
  message,
} from 'antd';
import { Wallet, ChevronLeft, ArrowRight, ShieldAlert, CheckCircle2, ExternalLink, Lock } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

export const BorrowLoanPage: React.FC = () => {
  const id = useParams<{ id: string }>().id || '';
  const navigate = useNavigate();
  const { loanOffers, oraclePrices, wallet, acceptOffer, activateLoan, transactions } = useAppContext();
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
  const [createdLoan, setCreatedLoan] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (minRequiredXLM) {
      setCollateralAmount(Math.ceil(minRequiredXLM));
      form.setFieldsValue({ collateral: Math.ceil(minRequiredXLM) });
    }
  }, [minRequiredXLM, form]);

  if (!offer && !createdLoan) {
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

  const repaymentAmt = calculateRepaymentAmount(
    offer ? offer.amount : createdLoan.amount,
    offer ? offer.apr : createdLoan.apr,
    offer ? offer.duration : createdLoan.duration
  );

  // Live simulation values
  const collateralValue = collateralAmount * xlmPrice;
  const currentLTV = calculateLTV(collateralAmount, xlmPrice, repaymentAmt, usdcPrice);
  const healthFactor = calculateHealthFactor(
    collateralAmount,
    xlmPrice,
    repaymentAmt,
    usdcPrice,
    offer ? offer.liquidationThreshold : createdLoan.liquidationThreshold
  );

  const estimatedLiquidationPrice = collateralAmount > 0
    ? repaymentAmt / (collateralAmount * ((offer ? offer.liquidationThreshold : createdLoan.liquidationThreshold) / 100))
    : 0;

  const canBorrow = healthFactor >= (offer ? offer.minHealthFactor : createdLoan.minHealthFactor) && wallet.balanceXLM >= collateralAmount;

  const handleBorrowSubmit = () => {
    form.validateFields().then(() => {
      setModalVisible(true);
    });
  };

  const handleConfirmBorrow = async () => {
    try {
      setLoading(true);
      const loan = await acceptOffer(offer!.id, collateralAmount);
      if (loan) {
        setCreatedLoan(loan);
        setModalVisible(false);
        message.success('Terms accepted on-chain. Please lock collateral to disburse funds.');
      } else {
        throw new Error('Borrow transaction failed');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLoan = async () => {
    if (!createdLoan) return;
    try {
      setLoading(true);
      const active = await activateLoan(createdLoan.id);
      if (active) {
        setCreatedLoan(active);
        message.success('Loan activated! USDC funds have been sent to your wallet.');
      } else {
        throw new Error('Activation transaction failed');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Find transaction records for steps
  const acceptTx = transactions.find(
    (tx) => tx.type === 'ACCEPT_OFFER' && (tx.loanId === createdLoan?.id || tx.offerId === id)
  );
  const activateTx = transactions.find(
    (tx) => tx.type === 'ACTIVATE_LOAN' && tx.loanId === createdLoan?.id
  );

  const currentStep = !createdLoan ? 0 : createdLoan.status === 'PendingCollateral' ? 1 : 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <Button
          type="text"
          icon={<ChevronLeft size={14} />}
          onClick={() => navigate(createdLoan ? '/app/borrower' : `/app/marketplace`)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)' }}
        >
          {createdLoan ? 'Go to Borrower Dashboard' : 'Back to Marketplace'}
        </Button>
        <Title level={2} style={{ margin: '8px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '28px', letterSpacing: '-0.03em' }}>
          {createdLoan ? 'Borrow Contract Wizard' : 'Initialize Borrow Request'}
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
          {createdLoan 
            ? 'Complete the two-step blockchain workflow to secure your loan.' 
            : 'Review the lender parameters, deposit collateral tokens, and confirm the debt agreement.'}
        </Paragraph>
      </div>

      {/* Two-step progress wizard */}
      <Card style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }} styles={{ body: { padding: '24px' } }}>
        <Steps
          current={currentStep}
          items={[
            {
              title: 'Accept Terms',
              description: createdLoan ? 'Agreement Deployed' : 'Awaiting confirmation',
              status: currentStep > 0 ? 'finish' : 'process',
            },
            {
              title: 'Activate Loan & Lock Collateral',
              description: createdLoan?.status === 'PendingCollateral' 
                ? 'Action Required' 
                : currentStep === 2 
                ? 'USDC Disbursed' 
                : 'Locked Escrow',
              status: currentStep === 1 ? 'process' : currentStep === 2 ? 'finish' : 'wait',
            },
          ]}
        />
      </Card>

      {createdLoan ? (
        /* Stepper Flow layout after offer acceptance */
        <Row gutter={[32, 32]}>
          <Col xs={24} lg={15}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={18} style={{ color: 'var(--primary-color)' }} />
                  <span>Borrow Settlement Workflow</span>
                </div>
              }
              style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }}
            >
              {createdLoan.status === 'PendingCollateral' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <Alert
                    type="warning"
                    showIcon
                    icon={<ShieldAlert style={{ color: 'var(--warning-color)' }} />}
                    message={<Text strong style={{ fontSize: '15px' }}>Offer Accepted - Collateral Pending</Text>}
                    description={
                      <div style={{ marginTop: '4px', fontSize: '13px', lineHeight: '1.5' }}>
                        The loan terms are accepted and recorded. However, <Text strong style={{ color: 'var(--danger-color)' }}>no USDC funds are disbursed</Text> until your XLM collateral is locked in the Vault Escrow.
                      </div>
                    }
                  />

                  <div style={{
                    padding: '20px',
                    backgroundColor: 'var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Collateral to Lock:</Text>
                      <Text strong style={{ fontSize: '15px', color: '#E28743' }}>{collateralAmount.toLocaleString()} XLM</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">USDC to Receive:</Text>
                      <Text strong style={{ fontSize: '15px', color: 'var(--success-color)' }}>${createdLoan.amount.toLocaleString()} USDC</Text>
                    </div>
                    {acceptTx && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Step 1 Transaction Hash:</Text>
                        <a href={acceptTx.explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                          {acceptTx.txHash?.slice(0, 8)}...{acceptTx.txHash?.slice(-8)} <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <Text type="secondary" style={{ fontSize: '12px', maxWidth: '60%' }}>
                      Requires Freighter Wallet approval to transfer XLM into Vault and release USDC.
                    </Text>
                    <Button
                      type="primary"
                      size="large"
                      loading={loading}
                      disabled={wallet.balanceXLM < collateralAmount}
                      onClick={handleActivateLoan}
                      icon={<CheckCircle2 size={16} style={{ marginRight: 6 }} />}
                      style={{ height: '48px', padding: '0 24px' }}
                    >
                      Activate Loan & Lock XLM
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <Alert
                    type="success"
                    showIcon
                    message={<Text strong style={{ fontSize: '15px' }}>USDC Borrowing Complete</Text>}
                    description={
                      <div style={{ marginTop: '4px', fontSize: '13px', lineHeight: '1.5' }}>
                        Your XLM collateral is locked, and the principal of <Text strong>{formatCurrency(createdLoan.amount, 'USDC')}</Text> has been disbursed directly to your Stellar account.
                      </div>
                    }
                  />

                  <div style={{
                    padding: '20px',
                    backgroundColor: 'var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Locked Collateral:</Text>
                      <Text strong style={{ color: '#E28743' }}>{createdLoan.collateralAmount.toLocaleString()} XLM</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Outstanding Repayment Debt:</Text>
                      <Text strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(createdLoan.outstandingDebt, 'USDC')}</Text>
                    </div>
                    {acceptTx && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Step 1 (Accept Offer) Hash:</Text>
                        <a href={acceptTx.explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                          {acceptTx.txHash?.slice(0, 8)}...{acceptTx.txHash?.slice(-8)} <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                    {activateTx && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Step 2 (Activate Loan) Hash:</Text>
                        <a href={activateTx.explorerUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                          {activateTx.txHash?.slice(0, 8)}...{activateTx.txHash?.slice(-8)} <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <Button size="large" onClick={() => navigate(`/app/loans/${createdLoan.id}`)}>
                      View Loan Specs
                    </Button>
                    <Button type="primary" size="large" onClick={() => navigate('/app/borrower')}>
                      Go to Borrower Dashboard
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </Col>

          {/* Right Side Simulator */}
          <Col xs={24} lg={9}>
            <Card
              title="Leverage Specifications"
              style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--border-light)' }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <HealthFactorGauge value={healthFactor} size={130} showMeaning />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <Text type="secondary">Collateral Value ($):</Text>
                  <Text strong>${collateralValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <Text type="secondary">Current LTV Ratio:</Text>
                  <Text strong>{currentLTV.toFixed(2)}%</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <Text type="secondary">Estimated Liquidation Price:</Text>
                  <Text strong style={{ color: 'var(--danger-color)' }}>${estimatedLiquidationPrice.toFixed(4)} USDC</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <Text type="secondary">Total Repayment Debt:</Text>
                  <Text strong>${repaymentAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC</Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      ) : (
        /* Form fields to accepts offer terms initially */
        <Row gutter={[32, 32]}>
          {/* Left: Summary */}
          <Col xs={24} md={8}>
            <Card title="Contract Offering Terms" style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }} styles={{ body: { padding: '24px' } }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>
                    BORROW PRINCIPAL
                  </span>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary-color)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                    {formatCurrency(offer!.amount, 'USDC')}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>
                    INTEREST RATE (FIXED)
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {offer!.apr}% APR
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>
                    CONTRACT DURATION
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {offer!.duration} Days
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 700, letterSpacing: '0.05em' }}>
                    ESCROW VAULT SECURED
                  </span>
                  <Tag color="cyan" style={{ border: 'none', fontWeight: 700, padding: '2px 8px', marginTop: '4px' }}>
                    Vault Isolated
                  </Tag>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Max LTV Limit:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer!.maxLTV}% LTV</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Liquidation Threshold:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer!.liquidationThreshold}% LTV</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Liquidation Penalty:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer!.liquidationBonus}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Lender Address:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{offer!.lender.slice(0, 8)}...{offer!.lender.slice(-8)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Col>

          {/* Center: Form */}
          <Col xs={24} md={8}>
            <Card title="Lock Escrow Collateral" style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }} styles={{ body: { padding: '24px' } }}>
              <Form form={form} layout="vertical">
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wallet size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Wallet XLM:</span>
                  </div>
                  <Text strong style={{ fontSize: '13px' }}>{wallet.balanceXLM.toLocaleString()} XLM</Text>
                </div>

                <Form.Item label="Collateral Asset Type" required>
                  <Select disabled value="XLM" size="large">
                    <Option value="XLM">XLM (Stellar Lumens)</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  label="Escrow Collateral Amount (XLM)"
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

                <Form.Item label="Borrow Asset Type" required>
                  <Select disabled value="USDC" size="large">
                    <Option value="USDC">USDC (USD Coin)</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="USDC Borrow Amount">
                  <InputNumber disabled value={offer!.amount} style={{ width: '100%' }} size="large" />
                </Form.Item>

                <Button
                  type="primary"
                  size="large"
                  disabled={!canBorrow}
                  loading={loading}
                  onClick={handleBorrowSubmit}
                  style={{ width: '100%', height: '48px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  Verify & Borrow <ArrowRight size={14} />
                </Button>
              </Form>
            </Card>
          </Col>

          {/* Right: Simulation Card */}
          <Col xs={24} md={8}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={16} style={{ color: 'var(--primary-color)' }} />
                  <span>Isolated Vault Risk Monitor</span>
                </div>
              }
              style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--border-light)' }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <HealthFactorGauge value={healthFactor} size={130} showMeaning />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <Text type="secondary">Collateral Value ($):</Text>
                  <Text strong>${collateralValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <Text type="secondary">Current LTV Ratio:</Text>
                  <Text strong style={{ color: currentLTV > offer!.maxLTV ? 'var(--danger-color)' : 'var(--success-color)' }}>
                    {currentLTV.toFixed(2)}% LTV
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <Text type="secondary">Liquidation LTV Trigger:</Text>
                  <Text strong style={{ color: 'var(--text-main)' }}>{offer!.liquidationThreshold}% LTV</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <Text type="secondary">Est. Liquidation Price:</Text>
                  <Text strong style={{ color: 'var(--danger-color)' }}>
                    ${estimatedLiquidationPrice.toFixed(4)} USDC
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px', fontSize: '13px' }}>
                  <Text type="secondary">Total Repayment Debt:</Text>
                  <Text strong style={{ color: 'var(--text-main)' }}>${repaymentAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', fontSize: '13px' }}>
                  <Text type="secondary">Oracle Feed XLM Price:</Text>
                  <Text strong style={{ fontFamily: 'var(--font-mono)' }}>${xlmPrice.toFixed(4)}</Text>
                </div>
              </div>

              {/* Validation Warnings */}
              {wallet.balanceXLM < collateralAmount ? (
                <Alert
                  message="Insufficient XLM Balance"
                  description={`You need ${collateralAmount.toLocaleString()} XLM, but your balance is only ${wallet.balanceXLM.toLocaleString()} XLM.`}
                  type="error"
                  showIcon
                />
              ) : healthFactor < 1.2 ? (
                <Alert
                  message="Critical Liquidation Risk"
                  description={`Safety margin is too narrow. Increase collateral amount to raise Health Factor above ${offer!.minHealthFactor.toFixed(2)}.`}
                  type="error"
                  showIcon
                />
              ) : healthFactor < 1.4 ? (
                <Alert
                  message="Low Health Factor Warning"
                  description={`Minimum initial Safety factor required is ${offer!.minHealthFactor.toFixed(2)}. Please add more collateral.`}
                  type="warning"
                  showIcon
                />
              ) : (
                <Alert
                  message="Healthy Leverage Safe"
                  description="Collateral protection is sufficient. Risk profile is safe for borrower draw."
                  type="success"
                  showIcon
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* Confirmation Modal */}
      {offer && (
        <ConfirmActionModal
          visible={modalVisible}
          onCancel={() => setModalVisible(false)}
          onConfirm={handleConfirmBorrow}
          title="Accept & Initialize Loan"
          actionText="Confirm Freighter Signature"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Paragraph>Review the isolated loan contract details below. Click confirm to invoke Freighter wallet authorization.</Paragraph>
            
            <div style={{
              background: 'var(--border-light)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>USDC Principal Borrowed:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>${offer.amount.toLocaleString()} USDC</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>XLM Collateral Locked:</span>
                <span style={{ fontWeight: 700, color: '#E28743' }}>{collateralAmount.toLocaleString()} XLM</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Estimated Repayment Debt:</span>
                <span style={{ fontWeight: 700, color: 'var(--success-color)' }}>${repaymentAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Duration:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.duration} Days</span>
              </div>
            </div>
            
            <Alert
              type="warning"
              showIcon
              message="Required Step 1 of 2"
              description="Accepting the terms initializes the loan as PendingCollateral on-chain. You must execute Step 2 (Activate Loan) in the next screen to finalize XLM escrow locking and disburse USDC funds."
            />
          </div>
        </ConfirmActionModal>
      )}
    </div>
  );
};
