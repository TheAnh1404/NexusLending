import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { DEFAULT_GRACE_PERIOD_DAYS, calculateRequiredCollateral } from '../utils/finance';
import { DATA_MODE } from '../services/api/client';
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
  Steps,
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
  Layers,
  ChevronRight
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
  expirationDays: number;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
};

const requiredNumber = (value: unknown, label: string): number => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${label} is missing. Go back to the previous steps and complete the field.`);
  }
  return numberValue;
};

export const CreateLoanPage: React.FC = () => {
  const { createOffer, fundOffer, activateOffer, oraclePrices, transactions } = useAppContext();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const isApiMode = DATA_MODE === 'api';
  
  // Steps state
  const [currentStep, setCurrentStep] = useState<number>(0);

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
  const asset = 'USDC';
  const collateralAsset = 'XLM';

  // Live preview metrics
  const interestEarned = amount && apr && duration ? amount * (apr / 100) * (duration / 365) : 0;
  const totalRepayment = amount ? amount + interestEarned : 0;

  const isUsdcLend = asset === 'USDC';
  const reqCollateralAmount = isUsdcLend
    ? (amount && maxLtv ? calculateRequiredCollateral(amount, 1.0, xlmPrice, maxLtv) : 0)
    : (amount && maxLtv && xlmPrice ? (amount * xlmPrice) / (maxLtv / 100) : 0);

  const reqCollateralVal = isUsdcLend
    ? reqCollateralAmount * xlmPrice
    : reqCollateralAmount;

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
      safe: { maxLtv: 50, liquidationThreshold: 65, minHealthFactor: 1.5, liquidationBonus: 8, gracePeriod: DEFAULT_GRACE_PERIOD_DAYS },
      balanced: { maxLtv: 60, liquidationThreshold: 75, minHealthFactor: 1.4, liquidationBonus: 10, gracePeriod: DEFAULT_GRACE_PERIOD_DAYS },
      aggressive: { maxLtv: 75, liquidationThreshold: 85, minHealthFactor: 1.4, liquidationBonus: 12, gracePeriod: DEFAULT_GRACE_PERIOD_DAYS }
    }[preset];

    form.setFieldsValue(config);
    setMaxLtv(config.maxLtv);
    setLiquidationThreshold(config.liquidationThreshold);
    setMinHealthFactor(config.minHealthFactor);
    setLiquidationBonus(config.liquidationBonus);
    setGracePeriod(config.gracePeriod);
    
    message.info(`Applied ${preset.toUpperCase()} risk profile presets.`);
  };

  const nextStep = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['amount', 'apr', 'duration', 'expirationDays']);
        setCurrentStep(1);
      } else if (currentStep === 1) {
        await form.validateFields(['maxLtv', 'liquidationThreshold', 'minHealthFactor', 'liquidationBonus', 'gracePeriod']);
        setCurrentStep(2);
      }
    } catch {
      message.error('Please fix the configuration errors before proceeding.');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const reportCreationError = (title: string, fallback: string, error?: unknown) => {
    const details = getErrorMessage(error, fallback);
    setErrorTitle(title);
    setErrorDetails(details);
    setExecStage('failed');
    setExecuting(false);
    message.error(details);
  };

  // Unified deployment execution flow
  const handleDeployOffer = async () => {
    form.setFieldsValue({ asset, collateralAsset });

    let values: CreateLoanFormValues;
    try {
      await form.validateFields([
        'amount',
        'apr',
        'duration',
        'expirationDays',
        'maxLtv',
        'liquidationThreshold',
        'minHealthFactor',
        'liquidationBonus',
        'gracePeriod',
      ]);
      const allValues = form.getFieldsValue(true) as Partial<CreateLoanFormValues>;
      values = {
        amount: requiredNumber(allValues.amount, 'Lending amount'),
        asset,
        apr: requiredNumber(allValues.apr, 'Fixed APR'),
        duration: requiredNumber(allValues.duration, 'Lending period'),
        collateralAsset,
        maxLtv: requiredNumber(allValues.maxLtv, 'Max LTV'),
        liquidationThreshold: requiredNumber(allValues.liquidationThreshold, 'Liquidation threshold'),
        liquidationBonus: requiredNumber(allValues.liquidationBonus, 'Liquidation bonus'),
        gracePeriod: requiredNumber(allValues.gracePeriod, 'Liquidation grace period'),
        minHealthFactor: requiredNumber(allValues.minHealthFactor, 'Minimum health factor'),
        description: allValues.description,
        expirationDays: requiredNumber(allValues.expirationDays, 'Offer lifespan'),
      };
    } catch (error) {
      reportCreationError('Form validation failed', 'Please fix the form configuration errors.', error);
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
        asset,
        apr: values.apr,
        duration: values.duration,
        collateralAsset,
        maxLTV: values.maxLtv,
        liquidationThreshold: values.liquidationThreshold,
        liquidationBonus: values.liquidationBonus,
        gracePeriod: values.gracePeriod,
        minHealthFactor: values.minHealthFactor,
        description: values.description ?? '',
      });
      if (!offer) {
        throw new Error(isApiMode
          ? 'Backend draft creation failed. Start the backend API and confirm the wallet is connected on Stellar Testnet.'
          : 'Failed to create draft offer.');
      }
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
          Create New Lending Offer
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
          Deploy capital to the marketplace using isolated smart escrows. Follow our wizard steps.
        </Paragraph>
      </div>

      {isApiMode && (
        <Alert
          type="info"
          showIcon
          message="Integrated Testnet mode is active"
          description={
            <span>
              This flow stores state through the backend API and requires Freighter signatures on Stellar Testnet for funding and activation.
            </span>
          }
        />
      )}

      {!isApiMode && (
        <Alert
          type="warning"
          showIcon
          message="Unsupported local data mode"
          description={
            <span>
              Freighter Testnet testing requires VITE_DATA_MODE=api. Update frontend/.env and restart the dev server.
            </span>
          }
        />
      )}

      {/* Modern Horizontal Steps Stepper */}
      <Card style={{ border: '1px solid var(--border-color)', borderRadius: '12px', backgroundColor: '#FFFFFF' }} styles={{ body: { padding: '20px 24px' } }}>
        <Steps
          current={currentStep}
          items={[
            { title: 'Capital Details', description: 'APR, Amount & Term' },
            { title: 'Risk Config', description: 'LTV & Safe HF thresholds' },
            { title: 'Confirm & Deploy', description: 'Workflow overview' },
          ]}
        />
      </Card>

      <Row gutter={[28, 28]}>
        {/* Left Column: Form Configuration Stepper */}
        <Col xs={24} lg={15}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              asset: 'USDC',
              collateralAsset: 'XLM',
              description,
              maxLtv: 60,
              liquidationThreshold: 75,
              minHealthFactor: 1.4,
              liquidationBonus: 10,
              gracePeriod: DEFAULT_GRACE_PERIOD_DAYS,
              expirationDays: 30
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
            }}
          >
            <Card style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              
              {/* STEP 0: Capital details */}
              {currentStep === 0 && (
                <div>
                  <Title level={5} style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', fontFamily: 'var(--font-heading)' }}>
                    1. Configure Capital Parameters
                  </Title>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Lending Asset" name="asset" rules={[{ required: true }]}>
                        <Select size="large" disabled>
                          <Option value="USDC">USDC (USD Coin stablecoin)</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Lending Amount (Principal)"
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
                          prefix={<DollarSign size={16} />}
                          placeholder="Enter amount"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

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
                      
                      {/* APR templates presets */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '-12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <Button size="small" type="dashed" onClick={() => { form.setFieldsValue({ apr: 5.0 }); setApr(5.0); }} style={{ fontSize: '11px' }}>
                          Conservative (5.0%)
                        </Button>
                        <Button size="small" type="dashed" onClick={() => { form.setFieldsValue({ apr: 8.5 }); setApr(8.5); }} style={{ fontSize: '11px' }}>
                          Balanced (8.5%)
                        </Button>
                        <Button size="small" type="dashed" onClick={() => { form.setFieldsValue({ apr: 12.0 }); setApr(12.0); }} style={{ fontSize: '11px' }}>
                          Aggressive (12.0%)
                        </Button>
                      </div>
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

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="Offer Lifespan (Marketplace Expiration)"
                        name="expirationDays"
                        rules={[
                          { required: true, message: 'Required' },
                          { type: 'number', min: 1, max: 90, message: '1-90 days' }
                        ]}
                      >
                        <InputNumber style={{ width: '100%' }} size="large" placeholder="Days offer remains open" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Lending Notes / Description" name="description">
                        <Input placeholder="Describe custom isolated details..." size="large" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                    <Button type="primary" size="large" onClick={nextStep} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Next: Configure Risk <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 1: Risk Configuration */}
              {currentStep === 1 && (
                <div>
                  <Title level={5} style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', fontFamily: 'var(--font-heading)' }}>
                    2. Risk and Protection Configuration
                  </Title>

                  <div style={{
                    background: 'var(--border-light)',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    marginBottom: '24px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                      QUICK RISK TEMPLATES (APPLY PRESET CONFIGURATION)
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <Button onClick={() => applyRiskPreset('safe')} size="small" style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)', borderRadius: '6px', fontWeight: 600 }}>
                        Conservative (LTV: 50%)
                      </Button>
                      <Button onClick={() => applyRiskPreset('balanced')} size="small" style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)', borderRadius: '6px', fontWeight: 600 }}>
                        Balanced (LTV: 60%)
                      </Button>
                      <Button onClick={() => applyRiskPreset('aggressive')} size="small" style={{ borderColor: 'var(--danger-color)', color: 'var(--danger-color)', borderRadius: '6px', fontWeight: 600 }}>
                        Aggressive Yield (LTV: 75%)
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
                        label="Minimum Initial Health Factor"
                        name="minHealthFactor"
                        rules={[
                          { required: true, message: 'Required' },
                          { type: 'number', min: 1.4, message: 'Min 1.40 target' }
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
                          { type: 'number', min: DEFAULT_GRACE_PERIOD_DAYS, max: DEFAULT_GRACE_PERIOD_DAYS, message: 'Grace period is fixed at 7 days' }
                        ]}
                      >
                        <InputNumber
                          disabled
                          style={{ width: '100%' }}
                          size="large"
                          placeholder="7-day repayment grace period"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                    <Button onClick={prevStep} size="large">
                      Back
                    </Button>
                    <Button type="primary" size="large" onClick={nextStep} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Next: Confirm & Deploy <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: Confirm & Deploy */}
              {currentStep === 2 && (
                <div>
                  <Title level={5} style={{ margin: '0 0 16px 0', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', fontFamily: 'var(--font-heading)' }}>
                    3. Review Deployment Workflow
                  </Title>

                  <Alert
                    type="info"
                    showIcon
                    icon={<Layers size={20} style={{ color: 'var(--primary-color)' }} />}
                    message={<Text strong style={{ fontSize: '15px' }}>Soroban Multi-Transaction Workflow</Text>}
                    description={
                      <div style={{ fontSize: '12px', lineHeight: '1.5', marginTop: 4 }}>
                        Nexus utilizes strict isolated lending escrows on Stellar. Deploying this offer will prompt your Freighter wallet for <b>three separate approvals</b>:
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, paddingLeft: 12 }}>
                          <div><b>1. Deploy Terms</b> (Registers parameters in Marketplace contract)</div>
                          <div><b>2. Lock Capital Escrow</b> (Transfers your USDC into Vault escrow)</div>
                          <div><b>3. Publish Listing</b> (Activates offer for borrowers to match)</div>
                        </div>
                      </div>
                    }
                    style={{ marginBottom: '24px' }}
                  />

                  {/* Summary Details */}
                  <div style={{
                    padding: '20px',
                    backgroundColor: 'var(--border-light)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginBottom: '24px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Offer Principal:</Text>
                      <Text strong style={{ fontSize: '15px' }}>{amount?.toLocaleString()} USDC</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Yield Terms:</Text>
                      <Text strong>{apr}% APR for {duration} Days</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Risk Level Classification:</Text>
                      <Tag color={risk.color} style={{ margin: 0, fontWeight: 700, border: 'none' }}>{risk.label.toUpperCase()}</Tag>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">LTV / Liquidation Threshold:</Text>
                      <Text strong>{maxLtv}% LTV Limit / {liquidationThreshold}% Threshold</Text>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                    <Button onClick={prevStep} size="large">
                      Back
                    </Button>
                    <Button
                      type="primary"
                      size="large"
                      onClick={handleDeployOffer}
                      icon={<Zap size={16} />}
                      loading={executing}
                      style={{ 
                        height: '48px', 
                        padding: '0 32px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600
                      }}
                    >
                      Authorize & Deploy Offer
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </Form>
        </Col>

        {/* Right Column: Live Yield & Collateral Preview */}
        <Col xs={24} lg={9}>
          <Card
            title={<span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lending Specifications</span>}
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

      {/* Modern Execution Overlay Modal */}
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
