import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Steps, Form, InputNumber, Select, Input, Button, Typography, Space, Tooltip, Row, Col, Alert } from 'antd';
import { HelpCircle, PlusCircle, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../../app/AppContext';
import { DEFAULT_GRACE_PERIOD_DAYS, MAX_FIXED_APR_PERCENT, calculateRepaymentAmount, formatCurrency } from '../../utils/finance';
import { TransactionProgress, type TransactionStepState } from './TransactionProgress';

const { Title, Paragraph, Text } = Typography;

interface CreateOfferWizardDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateOfferWizardDrawer: React.FC<CreateOfferWizardDrawerProps> = ({ open, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const { createOffer, fundOffer, activateOffer, oraclePrices, wallet } = useAppContext();
  const [form] = Form.useForm();

  const [currentStep, setCurrentStep] = useState(0);
  const [txState, setTxState] = useState<TransactionStepState>('idle');
  const [rawError, setRawError] = useState<string | undefined>(undefined);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // Form field state for live preview
  const [amount, setAmount] = useState<number>(1000);
  const [apr, setApr] = useState<number>(8);
  const [duration, setDuration] = useState<number>(30);
  const [maxLtv, setMaxLtv] = useState<number>(75);
  const [liquidationThreshold, setLiquidationThreshold] = useState<number>(80);
  const [minHealthFactor, setMinHealthFactor] = useState<number>(1.2);
  const [description, setDescription] = useState<string>('');

  const expectedTotalRepayment = calculateRepaymentAmount(amount, apr, duration);
  const expectedReturnInterest = expectedTotalRepayment - amount;
  const minCollateralUsdRequired = (amount / (maxLtv / 100));
  const minCollateralXlmRequired = minCollateralUsdRequired / xlmPrice;

  const handleNextFromTerms = async () => {
    try {
      await form.validateFields(['amount', 'apr', 'duration']);
      setCurrentStep(1);
    } catch {
      // Form validation failed
    }
  };

  const handleNextFromRules = async () => {
    try {
      await form.validateFields(['maxLtv', 'liquidationThreshold', 'minHealthFactor']);
      setCurrentStep(2);
    } catch {
      // Form validation failed
    }
  };

  const handlePublishOffer = async () => {
    setTxState('signing');
    setRawError(undefined);

    try {
      // Step 1: Create Draft Offer
      const draftOffer = await createOffer({
        amount,
        asset: 'USDC',
        apr,
        duration,
        collateralAsset: 'XLM',
        maxLTV: maxLtv,
        liquidationThreshold,
        liquidationBonus: 10,
        gracePeriod: DEFAULT_GRACE_PERIOD_DAYS,
        minHealthFactor,
        description: description || 'Standard Nexus Fixed Loan Offer',
      });

      if (!draftOffer) {
        setTxState('failed');
        setRawError('Failed to create offer contract draft.');
        return;
      }

      // Step 2: Fund Offer Escrow
      setTxState('simulating');
      const funded = await fundOffer(draftOffer.id);
      if (!funded) {
        setTxState('failed');
        setRawError('Failed to fund offer escrow with principal.');
        return;
      }

      // Step 3: Activate Offer
      setTxState('submitting');
      const activated = await activateOffer(draftOffer.id);
      if (activated) {
        setTxState('success');
        setCurrentStep(3);
        if (onSuccess) onSuccess();
      } else {
        setTxState('failed');
        setRawError('Offer funded but failed to publish on marketplace.');
      }
    } catch (error) {
      setTxState('failed');
      setRawError(error instanceof Error ? error.message : String(error));
    }
  };

  const steps = [
    { title: 'Terms' },
    { title: 'Collateral' },
    { title: 'Review' },
    { title: 'Publish' },
  ];

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        centered
        width={580}
        styles={{
          mask: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
          },
          body: {
            borderRadius: '16px',
            padding: '12px 4px',
          },
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-color, #4f46e5)',
            }}
          >
            <PlusCircle size={24} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
              Create Lending Offer
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Fund principal liquidity into Soroban smart escrow and earn fixed yield.
            </Text>
          </div>
        </div>

        <Steps current={currentStep} items={steps} size="small" style={{ marginBottom: 28 }} />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            amount: 1000,
            apr: 8,
            duration: 30,
            maxLtv: 75,
            liquidationThreshold: 80,
            minHealthFactor: 1.2,
          }}
        >
          {/* STEP 0: LOAN TERMS */}
          {currentStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Form.Item
                name="amount"
                label={<Text strong>Principal Borrow Amount (USDC)</Text>}
                rules={[{ required: true, message: 'Please enter loan amount' }]}
              >
                <InputNumber
                  style={{ width: '100%', borderRadius: 10 }}
                  size="large"
                  min={10}
                  max={100000}
                  value={amount}
                  onChange={(val) => setAmount(val || 1000)}
                  addonAfter="USDC"
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="apr"
                    label={<Text strong>Fixed Interest Rate (APR %)</Text>}
                    rules={[{ required: true, message: 'Please enter APR' }]}
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={1}
                      max={MAX_FIXED_APR_PERCENT}
                      value={apr}
                      onChange={(val) => setApr(val || 8)}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="duration"
                    label={<Text strong>Loan Duration (Days)</Text>}
                    rules={[{ required: true, message: 'Please enter duration' }]}
                  >
                    <Select
                      size="large"
                      style={{ borderRadius: 10 }}
                      value={duration}
                      onChange={(val) => setDuration(val)}
                      options={[
                        { value: 7, label: '7 Days' },
                        { value: 14, label: '14 Days' },
                        { value: 30, label: '30 Days' },
                        { value: 60, label: '60 Days' },
                        { value: 90, label: '90 Days' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Live Card Preview */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)',
                  borderRadius: 12,
                  padding: 16,
                  border: '1px solid rgba(79, 70, 229, 0.15)',
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text type="secondary">Expected Return Interest:</Text>
                  <Text strong style={{ color: 'var(--success-color, #10b981)' }}>
                    +{formatCurrency(expectedReturnInterest, 'USDC')}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Total Borrower Repayment:</Text>
                  <Text strong style={{ color: 'var(--primary-color, #4f46e5)' }}>
                    {formatCurrency(expectedTotalRepayment, 'USDC')}
                  </Text>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                block
                onClick={handleNextFromTerms}
                style={{ borderRadius: 10, marginTop: 8, height: 46, fontWeight: 700 }}
              >
                <span>Next: Collateral Rules</span>
                <ArrowRight size={18} />
              </Button>
            </div>
          )}

          {/* STEP 1: COLLATERAL RULES */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="maxLtv"
                    label={
                      <Space size={4}>
                        <Text strong>Maximum LTV (%)</Text>
                        <Tooltip title="Maximum Loan-to-Value ratio allowed for borrowers.">
                          <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </Space>
                    }
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={50}
                      max={90}
                      value={maxLtv}
                      onChange={(val) => setMaxLtv(val || 75)}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="liquidationThreshold"
                    label={
                      <Space size={4}>
                        <Text strong>Liquidation Threshold</Text>
                        <Tooltip title="Ratio below which a borrower loan is eligible for partial liquidation.">
                          <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </Space>
                    }
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={60}
                      max={95}
                      value={liquidationThreshold}
                      onChange={(val) => setLiquidationThreshold(val || 80)}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="minHealthFactor"
                label={
                  <Space size={4}>
                    <Text strong>Minimum Health Factor</Text>
                    <Tooltip title="Minimum health factor required when borrower accepts the offer.">
                      <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                    </Tooltip>
                  </Space>
                }
                rules={[{ required: true }]}
              >
                <InputNumber
                  style={{ width: '100%', borderRadius: 10 }}
                  size="large"
                  min={1.0}
                  max={2.0}
                  step={0.1}
                  value={minHealthFactor}
                  onChange={(val) => setMinHealthFactor(val || 1.2)}
                />
              </Form.Item>

              <Form.Item label={<Text strong>Memo / Note (Optional)</Text>}>
                <Input
                  placeholder="e.g. Standard 30-day USDC offer"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ borderRadius: 10, height: 42 }}
                />
              </Form.Item>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <Button size="large" onClick={() => setCurrentStep(0)} style={{ borderRadius: 10, height: 46 }}>
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </Button>
                <Button type="primary" size="large" block onClick={handleNextFromRules} style={{ borderRadius: 10, height: 46, fontWeight: 700 }}>
                  <span>Review Offer</span>
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Title level={5} style={{ marginTop: 0, marginBottom: 16, fontWeight: 700 }}>
                  Offer Breakdown
                </Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Principal Loan:</Text>
                    <Text strong>{formatCurrency(amount, 'USDC')}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Required Collateral:</Text>
                    <Text strong>{Math.ceil(minCollateralXlmRequired).toLocaleString()} XLM (${minCollateralUsdRequired.toFixed(2)})</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Duration & Rate:</Text>
                    <Text strong>{duration} Days @ {apr}% APR</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-color)', fontWeight: 600 }}>
                    <span>Your Expected Return:</span>
                    <span>{formatCurrency(expectedTotalRepayment, 'USDC')}</span>
                  </div>
                </div>
              </div>

              {wallet.balanceUSDC < amount && (
                <Alert
                  type="warning"
                  showIcon
                  message="Insufficient USDC Balance"
                  description={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span>You need more test USDC to fund this offer.</span>
                      <Button size="small" type="primary" onClick={() => navigate('/faucet?asset=USDC&returnTo=/app/marketplace')}>
                        Open Faucet
                      </Button>
                    </div>
                  }
                  style={{ marginBottom: 16 }}
                />
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <Button size="large" onClick={() => setCurrentStep(1)} style={{ borderRadius: 10, height: 46 }}>
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </Button>
                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={handlePublishOffer}
                  style={{ borderRadius: 10, height: 46, fontWeight: 700 }}
                >
                  Fund and Publish Offer
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS */}
          {currentStep === 3 && (
            <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CheckCircle2 size={56} style={{ color: 'var(--success-color)', margin: '0 auto' }} />
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                Offer Published on Marketplace!
              </Title>
              <Paragraph type="secondary" style={{ fontSize: 14 }}>
                Your principal of {formatCurrency(amount, 'USDC')} has been funded into Soroban smart escrow.
              </Paragraph>
              <Button type="primary" size="large" onClick={onClose} style={{ borderRadius: 10, height: 46, fontWeight: 700 }}>
                Done
              </Button>
            </div>
          )}
        </Form>
      </Modal>

      {/* Shared Transaction Progress Modal */}
      <TransactionProgress
        open={txState !== 'idle' && currentStep !== 3}
        state={txState}
        successMessage="Your lending offer has been funded and published to the marketplace."
        rawError={rawError}
        onClose={() => setTxState('idle')}
      />
    </>
  );
};
