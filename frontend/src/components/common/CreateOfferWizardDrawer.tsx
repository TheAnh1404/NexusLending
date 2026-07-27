import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Steps, Form, InputNumber, Select, Input, Button, Typography, Space, Tooltip, Row, Col, Alert } from 'antd';
import { HelpCircle, PlusCircle, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
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

  // Form field state for live preview (Start empty as requested by user)
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [apr, setApr] = useState<number | undefined>(undefined);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [maxLtv, setMaxLtv] = useState<number>(75);
  const [liquidationThreshold, setLiquidationThreshold] = useState<number>(80);
  const [minHealthFactor, setMinHealthFactor] = useState<number>(1.4);

  const [liquidationBonus, setLiquidationBonus] = useState<number>(10);
  const [description, setDescription] = useState<string>('');

  React.useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setTxState('idle');
      setRawError(undefined);
      setAmount(undefined);
      setApr(undefined);
      setDuration(undefined);
      setMaxLtv(75);
      setLiquidationThreshold(80);
      setMinHealthFactor(1.4);
      setLiquidationBonus(10);
      form.setFieldsValue({
        amount: undefined,
        apr: undefined,
        duration: undefined,
        maxLtv: 75,
        liquidationThreshold: 80,
        minHealthFactor: 1.4,
        liquidationBonus: 10,
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
      await form.validateFields(['maxLtv', 'liquidationThreshold', 'minHealthFactor', 'liquidationBonus']);
      setCurrentStep(2);
    } catch {
      // Form validation failed
    }
  };

  const handlePublishOffer = async () => {
    if (!amount || amount <= 0 || !apr || apr <= 0 || !duration || duration <= 0) {
      setTxState('failed');
      setRawError('Vui lòng nhập đầy đủ các điều khoản hợp lệ của khoản vay (Số tiền > 0, Lãi suất > 0%, Thời hạn > 0 ngày).');
      return;
    }

    const safeMaxLtv = maxLtv || 75;
    const safeLiqThreshold = liquidationThreshold || 80;
    const safeLiqBonus = liquidationBonus || 10;
    const safeMinHf = minHealthFactor || 1.4;

    if (safeMaxLtv <= 0 || safeMaxLtv > 90) {
      setTxState('failed');
      setRawError('Max LTV không hợp lệ. Phải nằm trong khoảng từ 1% đến 90%.');
      return;
    }

    if (safeMaxLtv >= safeLiqThreshold) {
      setTxState('failed');
      setRawError(`Max LTV (${safeMaxLtv}%) phải nhỏ hơn Ngưỡng thanh lý Liquidation Threshold (${safeLiqThreshold}%). Giao dịch bị dừng để tránh bị blockchain từ chối với lỗi Invalid max LTV.`);
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
        maxLTV: safeMaxLtv,
        liquidationThreshold: safeLiqThreshold,
        liquidationBonus: safeLiqBonus,
        gracePeriod: DEFAULT_GRACE_PERIOD_DAYS,
        minHealthFactor: safeMinHf,
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
              Type any custom loan parameter freely or pick from suggestion dropdowns.
            </Text>
          </div>
        </div>

        <Steps current={currentStep} items={steps} size="small" style={{ marginBottom: 28 }} />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            maxLtv: 75,
            liquidationThreshold: 80,
            minHealthFactor: 1.4,
            liquidationBonus: 10,
          }}
        >
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

              <Button
                type="primary"
                size="large"
                block
                onClick={handleNextFromTerms}
                style={{ borderRadius: 10, marginTop: 8, height: 46, fontWeight: 700 }}
              >
                <span>Next: Collateral & Safety Rules</span>
                <ArrowRight size={18} />
              </Button>
            </div>
          )}

          {/* STEP 1: COLLATERAL & SAFETY RULES */}
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
                    rules={[
                      { required: true, message: 'Please enter Max LTV' },
                      {
                        validator: (_, value) => {
                          const num = Number(value);
                          if (isNaN(num) || num <= 0 || num > 90) return Promise.reject(new Error('Max LTV must be between 1% and 90%'));
                          const liqThresh = form.getFieldValue('liquidationThreshold') ?? liquidationThreshold;
                          if (liqThresh && num >= liqThresh) {
                            return Promise.reject(new Error(`Max LTV (${num}%) must be less than Liquidation Threshold (${liqThresh}%)`));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={1}
                      max={90}
                      value={maxLtv}
                      onChange={(val) => {
                        if (val !== null && val !== undefined) {
                          const num = Number(val);
                          setMaxLtv(num);
                          form.setFieldsValue({ maxLtv: num });
                          form.validateFields(['maxLtv', 'liquidationThreshold']).catch(() => {});
                        }
                      }}
                      addonAfter={
                        <Select
                          placeholder="Suggestions"
                          style={{ width: 85 }}
                          value={maxLtv}
                          onChange={(val) => {
                            const num = Number(val);
                            setMaxLtv(num);
                            form.setFieldsValue({ maxLtv: num });
                            form.validateFields(['maxLtv', 'liquidationThreshold']).catch(() => {});
                          }}
                          options={[
                            { value: 50, label: '50%' },
                            { value: 60, label: '60%' },
                            { value: 65, label: '65%' },
                            { value: 70, label: '70%' },
                            { value: 75, label: '75%' },
                            { value: 80, label: '80%' },
                          ]}
                        />
                      }
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="liquidationThreshold"
                    label={
                      <Space size={4}>
                        <Text strong>Liquidation Threshold (%)</Text>
                        <Tooltip title="Ratio at which borrower position becomes eligible for liquidation.">
                          <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </Space>
                    }
                    rules={[
                      { required: true, message: 'Please enter Liquidation Threshold' },
                      {
                        validator: (_, value) => {
                          const num = Number(value);
                          if (isNaN(num) || num <= 0 || num > 95) return Promise.reject(new Error('Threshold must be between 1% and 95%'));
                          const mLtv = form.getFieldValue('maxLtv') ?? maxLtv;
                          if (mLtv && num <= mLtv) {
                            return Promise.reject(new Error(`Liquidation Threshold (${num}%) must be greater than Max LTV (${mLtv}%)`));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={1}
                      max={95}
                      value={liquidationThreshold}
                      onChange={(val) => {
                        if (val !== null && val !== undefined) {
                          const num = Number(val);
                          setLiquidationThreshold(num);
                          form.setFieldsValue({ liquidationThreshold: num });
                          form.validateFields(['maxLtv', 'liquidationThreshold']).catch(() => {});
                        }
                      }}
                      addonAfter={
                        <Select
                          placeholder="Suggestions"
                          style={{ width: 85 }}
                          value={liquidationThreshold}
                          onChange={(val) => {
                            const num = Number(val);
                            setLiquidationThreshold(num);
                            form.setFieldsValue({ liquidationThreshold: num });
                            form.validateFields(['maxLtv', 'liquidationThreshold']).catch(() => {});
                          }}
                          options={[
                            { value: 75, label: '75%' },
                            { value: 80, label: '80%' },
                            { value: 85, label: '85%' },
                            { value: 90, label: '90%' },
                            { value: 95, label: '95%' },
                          ]}
                        />
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="minHealthFactor"
                    label={
                      <Space size={4}>
                        <Text strong>Minimum Health Factor (Min HF)</Text>
                        <Tooltip title="Minimum health factor required for borrowers to open a loan under this offer.">
                          <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </Space>
                    }
                    rules={[
                      { required: true, message: 'Please enter Minimum Health Factor' },
                      {
                        validator: (_, value) => {
                          const num = Number(value);
                          if (isNaN(num) || num < 1.4) return Promise.reject(new Error('Min HF must be at least 1.4'));
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={1.4}
                      max={5.0}
                      step={0.1}
                      value={minHealthFactor}
                      onChange={(val) => {
                        if (val !== null && val !== undefined) {
                          setMinHealthFactor(val);
                          form.setFieldsValue({ minHealthFactor: val });
                        }
                      }}

                      addonAfter={
                        <Select
                          placeholder="Suggestions"
                          style={{ width: 85 }}
                          value={minHealthFactor}
                          onChange={(val) => {
                            const num = Number(val);
                            setMinHealthFactor(num);
                            form.setFieldsValue({ minHealthFactor: num });
                          }}
                          options={[
                            { value: 1.4, label: '1.4' },
                            { value: 1.5, label: '1.5' },
                            { value: 1.6, label: '1.6' },
                            { value: 1.8, label: '1.8' },
                            { value: 2.0, label: '2.0' },
                            { value: 2.5, label: '2.5' },
                          ]}

                        />
                      }
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="liquidationBonus"
                    label={
                      <Space size={4}>
                        <Text strong>Liquidator Bonus (%)</Text>
                        <Tooltip title="Bonus percentage rewarded to liquidator bots if collateral drops below safety threshold.">
                          <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </Space>
                    }
                    rules={[
                      { required: true, message: 'Please enter Liquidation Bonus' },
                      {
                        validator: (_, value) => {
                          const num = Number(value);
                          if (isNaN(num) || num < 0 || num > 30) return Promise.reject(new Error('Bonus must be between 0% and 30%'));
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      min={0}
                      max={30}
                      value={liquidationBonus}
                      onChange={(val) => {
                        if (val !== null && val !== undefined) {
                          setLiquidationBonus(val);
                          form.setFieldsValue({ liquidationBonus: val });
                        }
                      }}
                      addonAfter={
                        <Select
                          placeholder="Suggestions"
                          style={{ width: 85 }}
                          value={liquidationBonus}
                          onChange={(val) => {
                            const num = Number(val);
                            setLiquidationBonus(num);
                            form.setFieldsValue({ liquidationBonus: num });
                          }}
                          options={[
                            { value: 5, label: '5%' },
                            { value: 8, label: '8%' },
                            { value: 10, label: '10%' },
                            { value: 12, label: '12%' },
                            { value: 15, label: '15%' },
                          ]}
                        />
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>

              {maxLtv >= liquidationThreshold && (
                <Alert
                  type="error"
                  showIcon
                  icon={<AlertTriangle size={20} color="#ef4444" />}
                  message="Cảnh báo quy tắc An toàn (Max LTV ≥ Ngưỡng thanh lý)"
                  description={`Max LTV (${maxLtv}%) phải nhỏ hơn Ngưỡng thanh lý Liquidation Threshold (${liquidationThreshold}%). Vui lòng điều chỉnh lại để hợp đồng thông minh không từ chối giao dịch với lỗi 'Invalid max LTV'.`}
                  style={{ borderRadius: 10 }}
                />
              )}
              {maxLtv <= 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message="Cảnh báo LTV không hợp lệ"
                  description="Max LTV phải lớn hơn 0%. Vui lòng chọn tỷ lệ LTV gợi ý (ví dụ: 70% hoặc 75%)."
                  style={{ borderRadius: 10 }}
                />
              )}

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
                  Offer Parameters Breakdown
                </Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Principal Loan:</Text>
                    <Text strong>{formatCurrency(amount || 0, 'USDC')}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Required Collateral:</Text>
                    <Text strong>{Math.ceil(minCollateralXlmRequired).toLocaleString()} XLM (${minCollateralUsdRequired.toFixed(2)})</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Duration & Rate:</Text>
                    <Text strong>{duration || 0} Days @ {apr || 0}% APR</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Max LTV & Threshold:</Text>
                    <Text strong>{maxLtv}% Max LTV / {liquidationThreshold}% Threshold</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Min Health Factor:</Text>
                    <Text strong>{minHealthFactor} Min HF</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success-color)', fontWeight: 600 }}>
                    <span>Your Expected Return:</span>
                    <span>{formatCurrency(expectedTotalRepayment, 'USDC')}</span>
                  </div>
                </div>
              </div>

              {wallet.balanceUSDC < (amount || 0) && (
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
        open={txState !== 'idle' && currentStep !== 3}
        state={txState}
        successMessage="Your lending offer has been funded and published to the marketplace."
        rawError={rawError}
        onClose={() => setTxState('idle')}
      />
    </>
  );
};
