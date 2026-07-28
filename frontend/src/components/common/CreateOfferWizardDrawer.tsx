import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Steps, Form, InputNumber, Select, Input, Button, Typography, Row, Col, Alert, Tag } from 'antd';
import { PlusCircle, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, ChevronDown, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../../app/AppContext';
import {
  DEFAULT_GRACE_PERIOD_DAYS,
  MAX_FIXED_APR_PERCENT,
  PROTOCOL_RISK_PARAMETERS,
  calculateRepaymentAmount,
  formatCurrency,
} from '../../utils/finance';
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

  // Loan terms remain customizable; collateral safety is protocol-managed.
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [apr, setApr] = useState<number | undefined>(undefined);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState<string>('');

  const {
    maxLTV: maxLtv,
    liquidationThreshold,
    minHealthFactor,
    liquidationBonus,
  } = PROTOCOL_RISK_PARAMETERS;

  React.useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setTxState('idle');
      setRawError(undefined);
      setAmount(undefined);
      setApr(undefined);
      setDuration(undefined);
      setDescription('');
      form.setFieldsValue({
        amount: undefined,
        apr: undefined,
        duration: undefined,
      });
    }
  }, [open, form]);

  const safeAmount = amount || 0;
  const safeApr = apr || 0;
  const safeDuration = duration || 0;

  const expectedTotalRepayment = calculateRepaymentAmount(safeAmount, safeApr, safeDuration);
  const expectedReturnInterest = safeAmount > 0 ? expectedTotalRepayment - safeAmount : 0;
  const minCollateralUsdRequired = maxLtv > 0 ? (safeAmount / (maxLtv / 100)) : 0;
  const minCollateralXlmRequired = minCollateralUsdRequired / xlmPrice;

  const MIN_REQUIRED_XLM_GAS = 2.0;

  const isWalletConnected = wallet.connected && Boolean(wallet.address);
  const hasEnoughUSDC = (wallet.balanceUSDC || 0) >= safeAmount;
  const hasEnoughXLMGas = (wallet.balanceXLM || 0) >= MIN_REQUIRED_XLM_GAS;
  const isTermsValid = safeAmount > 0 && safeApr > 0 && safeDuration > 0;

  const canPublishOffer = isWalletConnected && hasEnoughUSDC && hasEnoughXLMGas && isTermsValid;

  const handleNextFromTerms = async () => {
    try {
      await form.validateFields(['amount', 'apr', 'duration']);
      setCurrentStep(1);
    } catch {
      // Form validation failed
    }
  };

  const handlePublishOffer = async () => {
    if (!isWalletConnected) {
      setTxState('failed');
      setRawError('Wallet not connected. Please connect your Freighter wallet before creating a loan offer.');
      return;
    }

    if (!hasEnoughUSDC) {
      setTxState('failed');
      setRawError(`Insufficient USDC balance to fund this offer (${(wallet.balanceUSDC || 0).toLocaleString()} USDC available, ${safeAmount.toLocaleString()} USDC required). Please top up via Faucet.`);
      return;
    }

    if (!hasEnoughXLMGas) {
      setTxState('failed');
      setRawError(`Insufficient XLM balance for Stellar network gas fees and account reserve (${(wallet.balanceXLM || 0).toLocaleString()} XLM available, minimum ${MIN_REQUIRED_XLM_GAS} XLM required). Please top up via Faucet.`);
      return;
    }

    if (!amount || amount <= 0 || !apr || apr <= 0 || !duration || duration <= 0) {
      setTxState('failed');
      setRawError('Please enter valid loan terms (Amount > 0, APR > 0%, Duration > 0 days).');
      return;
    }

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
        liquidationBonus,
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
        setCurrentStep(2);
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
        width={600}
        styles={{
          mask: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
          },
          body: {
            borderRadius: '16px',
            padding: '16px 8px',
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
              Set your lending terms. Collateral safeguards are applied automatically.
            </Text>
          </div>
        </div>

        <Steps current={currentStep} items={steps} size="small" style={{ marginBottom: 28 }} />

        <Form form={form} layout="vertical">
          {/* STEP 0: LOAN TERMS */}
          {currentStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Form.Item
                name="amount"
                label={<Text strong>Principal Borrow Amount (USDC)</Text>}
                rules={[
                  { required: true, message: 'Please enter loan amount' },
                  {
                    validator: (_, value) => {
                      const num = Number(value);
                      if (isNaN(num) || num <= 0) return Promise.reject(new Error('Amount must be greater than 0'));
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%', borderRadius: 10 }}
                  size="large"
                  min={1}
                  max={1000000}
                  placeholder="e.g. 1000"
                  value={amount}
                  onChange={(val) => {
                    const nextVal = val ?? undefined;
                    setAmount(nextVal);
                    form.setFieldsValue({ amount: nextVal });
                  }}
                  addonAfter={
                    <Select
                      placeholder=""
                      style={{ width: 44 }}
                      value={undefined}
                      popupMatchSelectWidth={false}
                      suffixIcon={<ChevronDown size={14} style={{ color: 'var(--text-muted, #64748b)' }} />}
                      onChange={(val) => {
                        const num = Number(val);
                        setAmount(num);
                        form.setFieldsValue({ amount: num });
                      }}
                      options={[
                        { value: 100, label: '100 USDC' },
                        { value: 200, label: '200 USDC' },
                        { value: 500, label: '500 USDC' },
                        { value: 1000, label: '1,000 USDC' },
                        { value: 2500, label: '2,500 USDC' },
                        { value: 5000, label: '5,000 USDC' },
                        { value: 10000, label: '10,000 USDC' },
                      ]}
                    />
                  }
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="apr"
                    label={<Text strong>Fixed Interest Rate (APR %)</Text>}
                    rules={[
                      { required: true, message: 'Please enter APR percentage' },
                      {
                        validator: (_, value) => {
                          const num = Number(value);
                          if (isNaN(num) || num <= 0) return Promise.reject(new Error('APR must be greater than 0%'));
                          if (num > MAX_FIXED_APR_PERCENT) {
                            return Promise.reject(new Error(`Maximum allowed APR limit is ${MAX_FIXED_APR_PERCENT}%`));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                    help={
                      apr && apr > MAX_FIXED_APR_PERCENT ? (
                        <div style={{ color: '#d97706', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                          <AlertTriangle size={14} style={{ flex: '0 0 14px' }} />
                          <span>High APR Warning: Exceeds recommended {MAX_FIXED_APR_PERCENT}% cap. High rates may reduce borrower demand.</span>
                        </div>
                      ) : undefined
                    }
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={0.1}
                      max={MAX_FIXED_APR_PERCENT}
                      placeholder="e.g. 8"
                      value={apr}
                      onChange={(val) => {
                        const nextVal = val ?? undefined;
                        setApr(nextVal);
                        form.setFieldsValue({ apr: nextVal });
                      }}
                      addonAfter={
                        <Select
                          placeholder=""
                          style={{ width: 44 }}
                          value={undefined}
                          popupMatchSelectWidth={false}
                          suffixIcon={<ChevronDown size={14} style={{ color: 'var(--text-muted, #64748b)' }} />}
                          onChange={(val) => {
                            const num = Number(val);
                            setApr(num);
                            form.setFieldsValue({ apr: num });
                          }}
                          options={[
                            { value: 5, label: '5% APR' },
                            { value: 8, label: '8% APR' },
                            { value: 10, label: '10% APR' },
                            { value: 12, label: '12% APR' },
                            { value: 15, label: '15% APR' },
                            { value: 18, label: '18% APR' },
                            { value: 20, label: '20% APR' },
                          ]}
                        />
                      }
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="duration"
                    label={<Text strong>Loan Duration (Days)</Text>}
                    rules={[
                      { required: true, message: 'Please enter duration' },
                      {
                        validator: (_, value) => {
                          const num = Number(value);
                          if (isNaN(num) || num <= 0) return Promise.reject(new Error('Duration must be greater than 0 days'));
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={1}
                      max={365}
                      placeholder="e.g. 30"
                      value={duration}
                      onChange={(val) => {
                        const nextVal = val ?? undefined;
                        setDuration(nextVal);
                        form.setFieldsValue({ duration: nextVal });
                      }}
                      addonAfter={
                        <Select
                          placeholder=""
                          style={{ width: 44 }}
                          value={undefined}
                          popupMatchSelectWidth={false}
                          suffixIcon={<ChevronDown size={14} style={{ color: 'var(--text-muted, #64748b)' }} />}
                          onChange={(val) => {
                            const num = Number(val);
                            setDuration(num);
                            form.setFieldsValue({ duration: num });
                          }}
                          options={[
                            { value: 7, label: '7 Days' },
                            { value: 14, label: '14 Days' },
                            { value: 30, label: '30 Days' },
                            { value: 60, label: '60 Days' },
                            { value: 90, label: '90 Days' },
                            { value: 180, label: '180 Days' },
                          ]}
                        />
                      }
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

              <Form.Item label={<Text strong>Memo / Note (Optional)</Text>} style={{ marginBottom: 0 }}>
                <Input
                  placeholder="e.g. Standard 30-day USDC offer"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ borderRadius: 10, height: 42 }}
                />
              </Form.Item>

              <Button
                type="primary"
                size="large"
                block
                onClick={handleNextFromTerms}
                style={{ borderRadius: 10, marginTop: 8, height: 46, fontWeight: 700 }}
              >
                <span>Review Offer</span>
                <ArrowRight size={18} />
              </Button>
            </div>
          )}

          {/* STEP 1: REVIEW */}
          {currentStep === 1 && (
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
                  Offer Summary
                </Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Principal Loan:</Text>
                    <Text strong>{formatCurrency(amount || 0, 'USDC')}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Minimum XLM Collateral:</Text>
                    <Text strong>{Math.ceil(minCollateralXlmRequired).toLocaleString()} XLM (${minCollateralUsdRequired.toFixed(2)})</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Duration & Rate:</Text>
                    <Text strong>{duration || 0} Days @ {apr || 0}% APR</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-color)', fontWeight: 600 }}>
                    <span>Your Expected Return:</span>
                    <span>{formatCurrency(expectedTotalRepayment, 'USDC')}</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  border: '1px solid rgba(79, 70, 229, 0.18)',
                  borderRadius: 14,
                  padding: 16,
                  background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06), rgba(6, 182, 212, 0.04))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary-color, #4f46e5)',
                        background: 'rgba(79, 70, 229, 0.12)',
                        flex: '0 0 auto',
                      }}
                    >
                      <ShieldCheck size={19} />
                    </div>
                    <div>
                      <Text strong style={{ display: 'block' }}>Protocol Collateral Protection</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Applied automatically to every XLM-backed offer.
                      </Text>
                    </div>
                  </div>
                  <Tag color="geekblue" style={{ margin: 0, fontWeight: 700 }}>FIXED</Tag>
                </div>

                <Row gutter={[10, 10]}>
                  {[
                    { label: 'Max LTV', value: `${maxLtv}%` },
                    { label: 'Liquidation Threshold', value: `${liquidationThreshold}%` },
                    { label: 'Minimum Health Factor', value: minHealthFactor.toFixed(1) },
                    { label: 'Liquidator Bonus', value: `${liquidationBonus}%` },
                  ].map((parameter) => (
                    <Col span={12} key={parameter.label}>
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(148, 163, 184, 0.22)',
                          background: 'rgba(255, 255, 255, 0.76)',
                        }}
                      >
                        <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>
                          {parameter.label}
                        </Text>
                        <Text strong style={{ fontSize: 16, color: 'var(--text-main)' }}>{parameter.value}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>

              {/* Pre-Flight Eligibility Check Card */}
              <div
                style={{
                  background: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    📋 Pre-Flight Eligibility Check
                  </Text>
                  {canPublishOffer ? (
                    <Tag color="success" style={{ fontWeight: 700, margin: 0 }}>
                      ✓ Eligible to Publish
                    </Tag>
                  ) : (
                    <Tag color="error" style={{ fontWeight: 700, margin: 0 }}>
                      ⚠️ Action Required
                    </Tag>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary">1. Freighter Wallet Status:</Text>
                    {isWalletConnected ? (
                      <Tag color="success" style={{ margin: 0 }}>✓ Wallet Connected</Tag>
                    ) : (
                      <Tag color="error" style={{ margin: 0 }}>✗ Wallet Not Connected</Tag>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary">2. Principal USDC Balance:</Text>
                    {hasEnoughUSDC ? (
                      <Tag color="success" style={{ margin: 0 }}>
                        ✓ ${(wallet.balanceUSDC || 0).toLocaleString()} / ${safeAmount.toLocaleString()} USDC
                      </Tag>
                    ) : (
                      <Tag color="error" style={{ margin: 0 }}>
                        ✗ ${(wallet.balanceUSDC || 0).toLocaleString()} USDC (Short ${(safeAmount - (wallet.balanceUSDC || 0)).toLocaleString()} USDC)
                      </Tag>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary">3. XLM Gas Fee & Reserve:</Text>
                    {hasEnoughXLMGas ? (
                      <Tag color="success" style={{ margin: 0 }}>
                        ✓ {(wallet.balanceXLM || 0).toLocaleString()} XLM (Sufficient)
                      </Tag>
                    ) : (
                      <Tag color="error" style={{ margin: 0 }}>
                        ✗ {(wallet.balanceXLM || 0).toLocaleString()} XLM (Min {MIN_REQUIRED_XLM_GAS} XLM required)
                      </Tag>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary">4. Collateral Policy:</Text>
                    <Tag color="success" style={{ margin: 0 }}>✓ Applied Automatically</Tag>
                  </div>
                </div>
              </div>

              {!hasEnoughUSDC && (
                <Alert
                  type="warning"
                  showIcon
                  message="Insufficient USDC Balance to Fund Offer"
                  description={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span>You need testnet USDC to fund the escrow for this loan offer.</span>
                      <Button size="small" type="primary" onClick={() => navigate('/faucet?asset=USDC&returnTo=/app/marketplace')}>
                        Open USDC Faucet
                      </Button>
                    </div>
                  }
                  style={{ borderRadius: 10 }}
                />
              )}

              {!hasEnoughXLMGas && (
                <Alert
                  type="error"
                  showIcon
                  icon={<AlertTriangle size={20} color="#ef4444" />}
                  message="Insufficient XLM Network Fee & Reserve"
                  description={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span>Your wallet requires at least {MIN_REQUIRED_XLM_GAS} XLM for network fees and base reserve.</span>
                      <Button size="small" type="primary" onClick={() => navigate('/faucet?asset=XLM&returnTo=/app/marketplace')}>
                        Open XLM Faucet
                      </Button>
                    </div>
                  }
                  style={{ borderRadius: 10 }}
                />
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <Button size="large" onClick={() => setCurrentStep(0)} style={{ borderRadius: 10, height: 46 }}>
                  <ArrowLeft size={16} />
                  <span>Back</span>
                </Button>
                <Button
                  type="primary"
                  size="large"
                  block
                  disabled={!canPublishOffer}
                  onClick={handlePublishOffer}
                  style={{ borderRadius: 10, height: 46, fontWeight: 700 }}
                >
                  {canPublishOffer ? 'Fund and Publish Offer' : 'Ineligible to Fund Offer'}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: SUCCESS */}
          {currentStep === 2 && (
            <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CheckCircle2 size={56} style={{ color: 'var(--success-color)', margin: '0 auto' }} />
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                Offer Published on Marketplace!
              </Title>
              <Paragraph type="secondary" style={{ fontSize: 14 }}>
                Your principal of {formatCurrency(amount || 0, 'USDC')} has been funded into Soroban smart escrow.
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
        open={txState !== 'idle' && currentStep !== 2}
        state={txState}
        successMessage="Your lending offer has been funded and published to the marketplace."
        rawError={rawError}
        onClose={() => setTxState('idle')}
      />
    </>
  );
};
