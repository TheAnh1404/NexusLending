import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateRequiredCollateral } from '../utils/finance';
import type { LoanOffer } from '../types';

import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Row,
  Col,
  Typography,
  Tooltip,
  Alert,
  Tag,
  App,
  Modal,
} from 'antd';
import {
  HelpCircle,
  ChevronLeft,
  Coins,
  Percent,
  DollarSign,
  CheckCircle2,
  ExternalLink,
  Zap,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

type ExecutionStage = 'idle' | 'drafting' | 'funding' | 'activating' | 'success' | 'failed';

interface CreateLoanFormValues {
  amount: number;
  asset: string;
  apr: number;
  duration: number;
  collateralAsset: string;
  maxLtv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  gracePeriod: number;
  minHealthFactor: number;
  description?: string;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
};

export const CreateLoanPage: React.FC = () => {
  const { createOffer, fundOffer, activateOffer, oraclePrices, transactions } = useAppContext();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  
  // Execution status states
  const [executing, setExecuting] = useState<boolean>(false);
  const [execStage, setExecStage] = useState<ExecutionStage>('idle');
  const [createdOffer, setCreatedOffer] = useState<LoanOffer | null>(null);
  const [errorTitle, setErrorTitle] = useState<string>('Execution Error');
  const [errorDetails, setErrorDetails] = useState<string>('');

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // Live preview states
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [apr, setApr] = useState<number | undefined>(undefined);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [maxLtv, setMaxLtv] = useState<number | undefined>(undefined);
  const [liquidationThreshold, setLiquidationThreshold] = useState<number | undefined>(undefined);
  const [, setLiquidationBonus] = useState<number | undefined>(undefined);
  const [, setMinHealthFactor] = useState<number | undefined>(undefined);
  const [, setGracePeriod] = useState<number | undefined>(undefined);
  const [, setExpirationDays] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState<string>('Custom isolated lending terms.');
  const [asset, setAsset] = useState<string>('USDC');
  const [collateralAsset, setCollateralAsset] = useState<string>('XLM');

  // Live preview metrics
  const interestEarned = amount && apr && duration ? amount * (apr / 100) * (duration / 365) : 0;
  const totalRepayment = amount ? amount + interestEarned : 0;

  const isUsdcLend = asset === 'USDC';
  const reqCollateralAmount = isUsdcLend
    ? (amount && maxLtv ? calculateRequiredCollateral(amount, 1.0, xlmPrice, maxLtv) : 0)
    : (amount && maxLtv && xlmPrice ? (amount * xlmPrice) / (maxLtv / 100) : 0);

  const reqCollateralVal = isUsdcLend
    ? reqCollateralAmount * xlmPrice
    : reqCollateralAmount; // since collateral is USDC, its USD value is equal to its amount

  // Dynamic Risk classification logic
  const getRiskLevel = () => {
    if (!maxLtv || !liquidationThreshold) return { label: 'No Data', color: 'default' };
    if (maxLtv > 75 || liquidationThreshold > 85) return { label: 'High Risk', color: 'volcano' };
    if (maxLtv > 60 || liquidationThreshold > 75) return { label: 'Moderate Risk', color: 'warning' };
    return { label: 'Low Risk', color: 'success' };
  };
  const risk = getRiskLevel();

  const applyRiskPreset = (preset: 'safe' | 'balanced' | 'aggressive') => {
    const config = {
      safe: { maxLtv: 50, liquidationThreshold: 65, minHealthFactor: 1.5, liquidationBonus: 8, gracePeriod: 5 },
      balanced: { maxLtv: 60, liquidationThreshold: 75, minHealthFactor: 1.4, liquidationBonus: 10, gracePeriod: 3 },
      aggressive: { maxLtv: 75, liquidationThreshold: 85, minHealthFactor: 1.4, liquidationBonus: 12, gracePeriod: 1 }
    }[preset];

    form.setFieldsValue(config);
    setMaxLtv(config.maxLtv);
    setLiquidationThreshold(config.liquidationThreshold);
    setMinHealthFactor(config.minHealthFactor);
    setLiquidationBonus(config.liquidationBonus);
    setGracePeriod(config.gracePeriod);
    
    message.info(`Applied ${preset.toUpperCase()} risk profile presets.`);
  };

  const reportCreationError = (title: string, fallback: string, error?: unknown) => {
    const details = getErrorMessage(error, fallback);
    setErrorTitle(title);
    setErrorDetails(details);
    setExecStage('failed');
    setExecuting(false);
    message.error(details);
  };

  // Unified single-button execution flow
  const handleDeployOffer = async () => {
    let values: CreateLoanFormValues;
    try {
      values = await form.validateFields();
    } catch {
      reportCreationError('Form validation failed', 'Please fix the form configuration errors.');
      return;
    }

    setExecuting(true);
    setExecStage('drafting');
    setErrorTitle('Execution Error');
    setErrorDetails('');
    
    // Step 1: Create draft off-chain
    let offer: LoanOffer | null = null;
    try {
      offer = await createOffer({
        amount: values.amount,
        asset: values.asset,
        apr: values.apr,
        duration: values.duration,
        collateralAsset: values.collateralAsset,
        maxLTV: values.maxLtv,
        liquidationThreshold: values.liquidationThreshold,
        liquidationBonus: values.liquidationBonus,
        gracePeriod: values.gracePeriod,
        minHealthFactor: values.minHealthFactor,
        description: values.description ?? '',
      });
      if (!offer) throw new Error('Failed to create draft offer on backend.');
      setCreatedOffer(offer);
    } catch (err) {
      console.error(err);
      reportCreationError('Draft creation failed', 'Unable to create the draft offer.', err);
      return;
    }

    // Step 2: Deploy & Fund on-chain (requires Freighter signatures)
    setExecStage('funding');
    let funded: LoanOffer | null = null;
    try {
      funded = await fundOffer(offer.id);
      if (!funded) throw new Error('Transaction rejected or failed during escrow funding.');
      setCreatedOffer(funded);
    } catch (err) {
      console.error(err);
      reportCreationError('Funding failed', 'Deployment and escrow funding failed.', err);
      return;
    }

    // Step 3: Activate listing on-chain (requires Freighter signature)
    setExecStage('activating');
    try {
      const active = await activateOffer(funded.id);
      if (!active) throw new Error('Listing activation transaction failed.');
      setCreatedOffer(active);
      setExecStage('success');
      message.success('Lending offer deployed and published to marketplace!');
    } catch (err) {
      console.error(err);
      reportCreationError('Activation failed', 'Marketplace activation transaction failed.', err);
    }
  };

  // Find transaction records for final success modal
  const fundTx = transactions.find(
    (tx) => tx.type === 'FUND_OFFER' && tx.offerId === createdOffer?.id
  );
  const activateTx = transactions.find(
    (tx) => tx.type === 'ACTIVATE_OFFER' && tx.offerId === createdOffer?.id
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Page Header */}
      <div>
        <Button
          type="text"
          icon={<ChevronLeft size={14} />}
          onClick={() => navigate('/app/marketplace')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)' }}
        >
          Back to Marketplace
        </Button>
        <Title level={2} style={{ margin: '8px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '26px', letterSpacing: '-0.03em' }}>
          Initialize lending offer
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          Define all parameters on a single form. Your capital will be deployed on-chain and listed instantly.
        </Paragraph>
      </div>

      <Row gutter={[28, 28]}>
        {/* Left Column: Form Configuration */}
        <Col xs={24} lg={15}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              asset: 'USDC',
              collateralAsset: 'XLM',
              description,
            }}
            onValuesChange={(_, all) => {
              setAmount(all.amount);
              setApr(all.apr);
              setDuration(all.duration);
              setMaxLtv(all.maxLtv);
              setLiquidationThreshold(all.liquidationThreshold);
              setLiquidationBonus(all.liquidationBonus);
              setMinHealthFactor(all.minHealthFactor);
              setGracePeriod(all.gracePeriod);
              setExpirationDays(all.expirationDays);
              setDescription(all.description || '');

              if (all.asset !== undefined && all.asset !== asset) {
                setAsset(all.asset);
                const nextCollateral = all.asset === 'USDC' ? 'XLM' : 'USDC';
                setCollateralAsset(nextCollateral);
                form.setFieldsValue({ collateralAsset: nextCollateral });
              }
              if (all.collateralAsset !== undefined && all.collateralAsset !== collateralAsset) {
                setCollateralAsset(all.collateralAsset);
                const nextAsset = all.collateralAsset === 'USDC' ? 'XLM' : 'USDC';
                setAsset(nextAsset);
                form.setFieldsValue({ asset: nextAsset });
              }
            }}
          >
            <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              
              {/* Part 1: Capital Configuration */}
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                  1. Capital Allocation
                </Title>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item label="Lending Asset" name="asset" rules={[{ required: true }]}>
                      <Select size="large" disabled>
                        <Option value="USDC">USDC (Stablecoin)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      label="Lending Amount"
                      name="amount"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 100, message: 'Min 100 tokens' },
                      ]}
                    >
                      <InputNumber
                        min={100}
                        max={1000000}
                        style={{ width: '100%' }}
                        size="large"
                        prefix={asset === 'USDC' ? <DollarSign size={16} /> : <Coins size={16} />}
                        placeholder="Enter amount"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      label="Offer Lifespan (Days)"
                      name="expirationDays"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 1, max: 90, message: '1-90 days' }
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} size="large" placeholder="Enter lifespan" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Part 2: Yield Terms */}
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                  2. Yield & Period
                </Title>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Fixed Rate (APR %)"
                      name="apr"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 1, message: 'Min 1%' },
                      ]}
                    >
                      <InputNumber
                        min={1}
                        max={50}
                        step={0.5}
                        style={{ width: '100%' }}
                        size="large"
                        prefix={<Percent size={14} />}
                        placeholder="Enter APR"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Lending Period Term (Days)"
                      name="duration"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 7, message: 'Min 7 days' },
                      ]}
                    >
                      <InputNumber min={7} max={365} style={{ width: '100%' }} size="large" placeholder="Enter term" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Part 3: Risk Configurations */}
              <div style={{ marginBottom: '24px' }}>
                <Title level={5} style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                  3. Collateral & Risk Parameters
                </Title>
                <div style={{
                  background: 'var(--border-light)',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    RECOMMENDED RISK PROFILE PRESETS
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Button onClick={() => applyRiskPreset('safe')} size="small" style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)', borderRadius: '6px' }}>
                      Safe (LTV: 50%)
                    </Button>
                    <Button onClick={() => applyRiskPreset('balanced')} size="small" style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)', borderRadius: '6px' }}>
                      Balanced (LTV: 60%)
                    </Button>
                    <Button onClick={() => applyRiskPreset('aggressive')} size="small" style={{ borderColor: 'red', color: 'red', borderRadius: '6px' }}>
                      Aggressive (LTV: 75%)
                    </Button>
                  </div>
                </div>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Collateral Asset Accepted" name="collateralAsset" rules={[{ required: true }]}>
                      <Select size="large" disabled>
                        <Option value="XLM">XLM (Stellar Lumens)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Maximum Loan-to-Value (Max LTV %)"
                      name="maxLtv"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 20, max: 80, message: 'Must be 20% to 80%' }
                      ]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        size="large"
                        prefix={<Percent size={14} />}
                        placeholder="Enter Max LTV"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Liquidation Threshold (%)
                          <Tooltip title="Threshold LTV at which the loan becomes vulnerable to liquidation. Must be >= Max LTV.">
                            <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                          </Tooltip>
                        </span>
                      }
                      name="liquidationThreshold"
                      rules={[
                        { required: true, message: 'Required' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || value >= getFieldValue('maxLtv')) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('Liquidation Threshold must be >= Max LTV'));
                          },
                        }),
                      ]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        size="large"
                        prefix={<Percent size={14} />}
                        placeholder="Enter Liquidation Threshold"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Minimum Health Factor"
                      name="minHealthFactor"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 1.4, message: 'Min 1.4' }
                      ]}
                    >
                      <InputNumber min={1.4} step={0.05} style={{ width: '100%' }} size="large" placeholder="Enter Min Health Factor" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Liquidation Penalty/Bonus (%)"
                      name="liquidationBonus"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 1, max: 20, message: '1% to 20%' }
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} size="large" prefix={<Percent size={14} />} placeholder="Enter Bonus" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Liquidation Grace Period (Days)"
                      name="gracePeriod"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 0, max: 30, message: '0-30 days' }
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} size="large" placeholder="Enter Grace Period" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '16px' }}>
                <Form.Item label="Lending Notes / Description" name="description">
                  <Input.TextArea placeholder="Describe any isolated matching rules..." rows={2} style={{ borderRadius: '6px' }} />
                </Form.Item>
              </div>

              {/* Main Submit Action */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '8px' }}>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleDeployOffer}
                  icon={<Zap size={16} />}
                  loading={executing && !['failed', 'success'].includes(execStage)}
                  disabled={executing && !['failed', 'success'].includes(execStage)}
                  style={{
                    height: '48px',
                    fontWeight: 600,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '6px',
                    boxShadow: '0 8px 16px rgba(79, 70, 229, 0.25)'
                  }}
                >
                  Initialize Lending Contract
                </Button>
              </div>
            </Card>
          </Form>
        </Col>

        {/* Right Column: Live Yield & Collateral Preview */}
        <Col xs={24} lg={9}>
          <Card
            title={<span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lending Specifications</span>}
            style={{
              border: '1px solid var(--border-color)',
              background: 'linear-gradient(to bottom, var(--border-light) 0%, rgba(241, 245, 249, 0.4) 100%)',
              borderRadius: '12px',
              position: 'sticky',
              top: '90px'
            }}
            styles={{ body: { padding: '24px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ textAlign: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', display: 'block' }}>
                  PROJECTED INTEREST YIELD
                </span>
                <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--success-color)', fontFamily: 'var(--font-heading)' }}>
                  +{interestEarned ? (isUsdcLend ? `$${interestEarned.toFixed(2)}` : `${interestEarned.toFixed(4)}`) : '0'}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                  in {asset}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lending Principal:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {amount ? `${amount.toLocaleString()} ${asset}` : '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lock Term:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {duration ? `${duration} Days` : '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fixed Yield Rate:</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                    {apr ? `${apr}% APR` : '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Repayment:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {amount ? `${totalRepayment.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${asset}` : '-'}
                  </span>
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', display: 'block' }}>
                  COLLATERAL REQUIREMENT (EST)
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Collateral Required:</span>
                  <span style={{ fontWeight: 700, color: '#E28743' }}>
                    {reqCollateralAmount ? `${reqCollateralAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${collateralAsset}` : '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Collateral Value:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {amount ? `$${reqCollateralVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '6px', marginTop: '2px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Risk Class Assessment:</span>
                  <Tag color={risk.color} style={{ margin: 0, fontWeight: 700, border: 'none', padding: '1px 6px', fontSize: '10px' }}>
                    {risk.label.toUpperCase()}
                  </Tag>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', textAlign: 'center' }}>
                Estimates based on current Stellar Anchor Oracle Feed XLM Price: <strong>${xlmPrice.toFixed(4)} USDC</strong>.
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 4. Modern Execution Overlay Modal */}
      <Modal
        open={executing || execStage === 'success' || execStage === 'failed'}
        footer={null}
        closable={execStage === 'success' || execStage === 'failed'}
        onCancel={() => {
          if (execStage === 'success') {
            setExecuting(false);
            setExecStage('idle');
            navigate('/app/marketplace');
          } else if (execStage === 'failed') {
            setExecuting(false);
            setExecStage('idle');
          }
        }}
        width={460}
        destroyOnHidden
        style={{ borderRadius: '16px', overflow: 'hidden' }}
      >
        <div style={{ padding: '24px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {execStage === 'failed' ? (
            <>
              <Alert
                type="error"
                showIcon
                message={errorTitle}
                description={errorDetails}
                style={{ width: '100%' }}
              />
              <Button
                size="large"
                onClick={() => {
                  setExecuting(false);
                  setExecStage('idle');
                }}
                style={{ width: '100%', height: '44px' }}
              >
                Back to form
              </Button>
            </>
          ) : execStage !== 'success' ? (
            <>
              <div className="animate-spin" style={{ color: 'var(--primary-color)' }}>
                <Coins size={48} />
              </div>
              <Title level={4} style={{ margin: 0, textAlign: 'center' }}>
                {execStage === 'drafting' && 'Step 1/3: Storing configuration...'}
                {execStage === 'funding' && 'Step 2/3: Deploying & Funding escrow...'}
                {execStage === 'activating' && 'Step 3/3: Listing on marketplace...'}
              </Title>
              <Paragraph type="secondary" style={{ textAlign: 'center', margin: 0, fontSize: '13px', maxWidth: '350px' }}>
                {execStage === 'drafting' && 'Laying out contract specifications and verifying terms locally...'}
                {execStage === 'funding' && 'Please approve the Freighter signatures. This will deploy the isolated lending contract and transfer stablecoins into vault escrow.'}
                {execStage === 'activating' && 'Publishing on-chain reference to the marketplace to make it discoverable for matching borrowers.'}
              </Paragraph>
            </>
          ) : (
            <>
              <CheckCircle2 size={60} style={{ color: 'var(--success-color)' }} />
              <div style={{ textAlign: 'center' }}>
                <Title level={4} style={{ margin: 0 }}>Lending Offer Activated!</Title>
                <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                  Your contract is now live and listed in the marketplace.
                </Paragraph>
              </div>

              <div style={{ width: '100%', background: 'var(--border-light)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {fundTx && fundTx.txHash && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <Text type="secondary">Escrow Funding Tx:</Text>
                    <a href={fundTx.explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                      {fundTx.txHash.slice(0, 6)}...{fundTx.txHash.slice(-6)} <ExternalLink size={11} />
                    </a>
                  </div>
                )}
                {activateTx && activateTx.txHash && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <Text type="secondary">Market Activation Tx:</Text>
                    <a href={activateTx.explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                      {activateTx.txHash.slice(0, 6)}...{activateTx.txHash.slice(-6)} <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
                <Button size="large" onClick={() => {
                  setExecuting(false);
                  setExecStage('idle');
                  navigate('/app/lender');
                }} style={{ flex: 1, height: '44px' }}>
                  Go to Dashboard
                </Button>
                <Button type="primary" size="large" onClick={() => {
                  setExecuting(false);
                  setExecStage('idle');
                  navigate('/app/marketplace');
                }} style={{ flex: 1, height: '44px', fontWeight: 600 }}>
                  Marketplace
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
