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
  Steps,
  App,
} from 'antd';
import { HelpCircle, ChevronLeft, ArrowRight, Eye, CheckCircle2, ExternalLink, Coins } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

export const CreateLoanPage: React.FC = () => {
  const { createOffer, fundOffer, activateOffer, oraclePrices, transactions } = useAppContext();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  
  // Steps workflow state: 
  // 0: Terms, 1: Risk, 2: Review, 3: Fund Offer, 4: Activate, 5: Live
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [createdOffer, setCreatedOffer] = useState<LoanOffer | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // Live preview states
  const [amount, setAmount] = useState<number>(5000);
  const [apr, setApr] = useState<number>(8.0);
  const [duration, setDuration] = useState<number>(60);
  const [maxLtv, setMaxLtv] = useState<number>(60);
  const [liquidationThreshold, setLiquidationThreshold] = useState<number>(75);
  const [liquidationBonus, setLiquidationBonus] = useState<number>(10);
  const [minHealthFactor, setMinHealthFactor] = useState<number>(1.4);
  const [gracePeriod, setGracePeriod] = useState<number>(3);
  const [expirationDays, setExpirationDays] = useState<number>(30);
  const [description, setDescription] = useState<string>('Custom isolated lending terms.');

  // Live preview metrics
  const interestEarned = amount * (apr / 100) * (duration / 365);
  const totalRepayment = amount + interestEarned;
  const reqCollateralXLM = calculateRequiredCollateral(amount, 1.0, xlmPrice, maxLtv);
  const reqCollateralVal = reqCollateralXLM * xlmPrice;

  // Dynamic Risk classification logic
  const getRiskLevel = () => {
    if (maxLtv > 75 || liquidationThreshold > 85) return { label: 'High Risk', color: 'volcano' };
    if (maxLtv > 60 || liquidationThreshold > 75) return { label: 'Moderate Risk', color: 'warning' };
    return { label: 'Low Risk', color: 'success' };
  };
  const risk = getRiskLevel();

  const handleNextFromTerms = () => {
    form.validateFields(['asset', 'amount', 'apr', 'duration']).then(() => {
      setCurrentStep(1);
    });
  };

  const handleNextFromRisk = () => {
    form.validateFields([
      'collateralAsset',
      'maxLtv',
      'liquidationThreshold',
      'minHealthFactor',
      'liquidationBonus',
      'gracePeriod',
      'expirationDays',
    ]).then(() => {
      setCurrentStep(2);
    });
  };

  // Create initial offer call
  const handleCreateOffer = async () => {
    try {
      setLoading(true);
      const created = await createOffer({
        amount,
        asset: form.getFieldValue('asset'),
        apr,
        duration,
        collateralAsset: form.getFieldValue('collateralAsset'),
        maxLTV: maxLtv,
        liquidationThreshold,
        liquidationBonus,
        gracePeriod,
        minHealthFactor,
        description,
      });

      if (created) {
        setCreatedOffer(created);
        setCurrentStep(3); // Go to Fund step
        message.success('Loan offer created successfully as Draft on-chain.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fund offer escrow call
  const handleFundOffer = async () => {
    if (!createdOffer) return;
    try {
      setLoading(true);
      const funded = await fundOffer(createdOffer.id);
      if (funded) {
        setCreatedOffer(funded);
        setCurrentStep(4); // Go to Activate step
        message.success('Escrow funded successfully on-chain.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Activate offer marketplace listing
  const handleActivateOffer = async () => {
    if (!createdOffer) return;
    try {
      setLoading(true);
      const active = await activateOffer(createdOffer.id);
      if (active) {
        setCreatedOffer(active);
        setCurrentStep(5); // Go to Complete step
        message.success('Listing activated! Published to the marketplace.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Find transaction records for steps
  const createTx = transactions.find(
    (tx) => tx.type === 'CREATE_OFFER' && tx.offerId === createdOffer?.id
  );
  const fundTx = transactions.find(
    (tx) => tx.type === 'FUND_OFFER' && tx.offerId === createdOffer?.id
  );
  const activateTx = transactions.find(
    (tx) => tx.type === 'ACTIVATE_OFFER' && tx.offerId === createdOffer?.id
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <Button
          type="text"
          icon={<ChevronLeft size={14} />}
          onClick={() => navigate('/app/marketplace')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)' }}
        >
          Back to Marketplace
        </Button>
        <Title level={2} style={{ margin: '8px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '28px', letterSpacing: '-0.03em' }}>
          DeFi Loan Offer Wizard
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
          Configure terms, lock stablecoin liquidity, and publish your peer-to-peer lending contract.
        </Paragraph>
      </div>

      {/* Stepper Wizard Indicator */}
      <Card style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }} styles={{ body: { padding: '20px' } }}>
        <Steps
          current={currentStep}
          items={[
            { title: 'Configure Terms' },
            { title: 'Risk Config' },
            { title: 'Review Terms' },
            { title: 'Create Offer' },
            { title: 'Fund Escrow' },
            { title: 'Activate Listing' },
          ]}
        />
      </Card>

      <Row gutter={[32, 32]}>
        {/* Left column form wizard */}
        <Col xs={24} lg={15}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              amount,
              apr,
              duration,
              asset: 'USDC',
              collateralAsset: 'XLM',
              maxLtv,
              liquidationThreshold,
              liquidationBonus,
              gracePeriod,
              minHealthFactor,
              expirationDays,
              description,
            }}
            onValuesChange={(_, all) => {
              if (all.amount !== undefined) setAmount(all.amount || 0);
              if (all.apr !== undefined) setApr(all.apr || 0);
              if (all.duration !== undefined) setDuration(all.duration || 0);
              if (all.maxLtv !== undefined) setMaxLtv(all.maxLtv || 0);
              if (all.liquidationThreshold !== undefined) setLiquidationThreshold(all.liquidationThreshold || 0);
              if (all.liquidationBonus !== undefined) setLiquidationBonus(all.liquidationBonus || 0);
              if (all.minHealthFactor !== undefined) setMinHealthFactor(all.minHealthFactor || 1.4);
              if (all.gracePeriod !== undefined) setGracePeriod(all.gracePeriod || 3);
              if (all.expirationDays !== undefined) setExpirationDays(all.expirationDays || 30);
              if (all.description !== undefined) setDescription(all.description || '');
            }}
          >
            {currentStep === 0 && (
              <Card title="Step 1: Configure Loan Terms" style={{ border: '1px solid var(--border-color)' }}>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Lending Asset" name="asset" rules={[{ required: true }]}>
                      <Select size="large">
                        <Option value="USDC">USDC (Stablecoin)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Lending Amount (USDC)"
                      name="amount"
                      rules={[
                        { required: true, message: 'Please enter loan amount' },
                        { type: 'number', min: 1, message: 'Amount must be greater than 0' },
                      ]}
                    >
                      <InputNumber min={1} max={100000} style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Fixed Interest Rate (APR %)"
                      name="apr"
                      rules={[
                        { required: true, message: 'Please enter APR' },
                        { type: 'number', min: 0.1, message: 'APR must be greater than 0' },
                      ]}
                    >
                      <InputNumber min={0.1} max={30} step={0.1} style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Loan Term Duration (Days)"
                      name="duration"
                      rules={[
                        { required: true, message: 'Please enter duration' },
                        { type: 'number', min: 1, message: 'Duration must be greater than 0' },
                      ]}
                    >
                      <InputNumber min={1} max={365} style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                </Row>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <Button type="primary" size="large" onClick={handleNextFromTerms}>
                    Next: Configure Risk & Collateral <ArrowRight size={14} style={{ marginLeft: 6 }} />
                  </Button>
                </div>
              </Card>
            )}

            {currentStep === 1 && (
              <Card title="Step 2: Configure Collateral & Risk" style={{ border: '1px solid var(--border-color)' }}>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Accepted Collateral Asset" name="collateralAsset" rules={[{ required: true }]}>
                      <Select size="large">
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
                        { type: 'number', min: 10, max: 90, message: 'Must be between 10% and 90%' }
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label={
                        <span>
                          Liquidation LTV Threshold (%)&nbsp;
                          <Tooltip title="Threshold LTV at which the loan becomes vulnerable to liquidation. Must be >= Max LTV.">
                            <HelpCircle size={12} style={{ color: 'var(--text-muted)' }} />
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
                      <InputNumber style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Minimum Health Factor Required"
                      name="minHealthFactor"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 1.0, message: 'Must be >= 1.0' }
                      ]}
                    >
                      <InputNumber step={0.05} style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      label="Liquidation Bonus (%)"
                      name="liquidationBonus"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 0, message: 'Must be >= 0%' }
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={8}>
                    <Form.Item
                      label="Grace Period (Days)"
                      name="gracePeriod"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 0, message: 'Must be >= 0 days' }
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={12} sm={8}>
                    <Form.Item
                      label="Offer Expiration (Days)"
                      name="expirationDays"
                      rules={[
                        { required: true, message: 'Required' },
                        { type: 'number', min: 1, message: 'Must be >= 1 day' }
                      ]}
                    >
                      <InputNumber style={{ width: '100%' }} size="large" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Lending Memo / Description" name="description">
                  <Input.TextArea placeholder="Describe any custom borrower matching terms..." rows={2} />
                </Form.Item>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <Button onClick={() => setCurrentStep(0)}>Back to Terms</Button>
                  <Button type="primary" size="large" onClick={handleNextFromRisk}>
                    Next: Review parameters <ArrowRight size={14} style={{ marginLeft: 6 }} />
                  </Button>
                </div>
              </Card>
            )}

            {currentStep === 2 && (
              <Card title="Step 3: Review Lending Offer Specifications" style={{ border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <Alert
                    type="info"
                    message="Deployment Verification"
                    description="Please review your terms carefully. Once initialized, the agreement parameters are immutable on-chain."
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
                      <Text type="secondary">Lending Asset & Amount:</Text>
                      <Text strong>{amount.toLocaleString()} USDC</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Fixed APR Rate:</Text>
                      <Text strong style={{ color: 'var(--primary-color)' }}>{apr}% APR</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Duration Period:</Text>
                      <Text strong>{duration} Days</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Required Collateral Value (Est):</Text>
                      <Text strong style={{ color: '#E28743' }}>{reqCollateralXLM.toLocaleString()} XLM (${reqCollateralVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">Offer Expiration:</Text>
                      <Text strong>{expirationDays} Days</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                      <Text type="secondary">Accrued Yield Interest:</Text>
                      <Text strong style={{ color: 'var(--success-color)' }}>+${interestEarned.toFixed(2)} USDC</Text>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    <Button onClick={() => setCurrentStep(1)}>Back to Risk Config</Button>
                    <Button
                      type="primary"
                      size="large"
                      loading={loading}
                      onClick={handleCreateOffer}
                      icon={<CheckCircle2 size={16} style={{ marginRight: 6 }} />}
                    >
                      Sign & Deploy Offer on Stellar
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {currentStep === 3 && createdOffer && (
              <Card title="Step 4: Fund Escrow Vault" style={{ border: '2px solid var(--primary-color)', backgroundColor: 'rgba(79, 70, 229, 0.01)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <Alert
                    type="success"
                    showIcon
                    message="Lending Offer Terms Deployed"
                    description={
                      <div>
                        Offer ID: <Text code style={{ fontFamily: 'var(--font-mono)' }}>{createdOffer.id}</Text> is registered as a <Tag color="blue">Draft</Tag> on-chain.
                      </div>
                    }
                  />

                  {createTx && (
                    <div style={{ padding: '12px', background: 'var(--border-light)', borderRadius: '6px', fontSize: '12px' }}>
                      <strong>Creation Tx Hash:</strong>{' '}
                      <a href={createTx.explorerUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)' }}>
                        {createTx.txHash} <ExternalLink size={12} style={{ display: 'inline', marginLeft: 4 }} />
                      </a>
                    </div>
                  )}

                  <div style={{
                    padding: '20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <Title level={5} style={{ margin: 0 }}>Escrow Deposit Required</Title>
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      Fund this offer to lock your stablecoin liquidity in the contract vault escrow. This makes the listing eligible for marketplace activation.
                    </Text>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                      <Text type="secondary">Escrow Lock Amount:</Text>
                      <Text strong style={{ fontSize: '16px', color: 'var(--primary-color)' }}>{amount.toLocaleString()} USDC</Text>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      size="large"
                      loading={loading}
                      onClick={handleFundOffer}
                      icon={<Coins size={16} style={{ marginRight: 6 }} />}
                      style={{ height: '48px' }}
                    >
                      Fund Escrow & Lock USDC
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {currentStep === 4 && createdOffer && (
              <Card title="Step 5: Activate Marketplace Listing" style={{ border: '2px solid var(--success-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <Alert
                    type="success"
                    showIcon
                    message="USDC Capital Vault Funded"
                    description="Your stablecoins are safely locked in the Vault/Escrow contract."
                  />

                  {fundTx && (
                    <div style={{ padding: '12px', background: 'var(--border-light)', borderRadius: '6px', fontSize: '12px' }}>
                      <strong>Funding Tx Hash:</strong>{' '}
                      <a href={fundTx.explorerUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)' }}>
                        {fundTx.txHash} <ExternalLink size={12} style={{ display: 'inline', marginLeft: 4 }} />
                      </a>
                    </div>
                  )}

                  <div style={{
                    padding: '20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <Title level={5} style={{ margin: 0 }}>List Offer on Marketplace</Title>
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      Your escrow is fully funded. Publish the listing to make it discoverable for borrowers to match on the public marketplace.
                    </Text>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      size="large"
                      loading={loading}
                      onClick={handleActivateOffer}
                      icon={<Eye size={16} style={{ marginRight: 6 }} />}
                      style={{ height: '48px' }}
                    >
                      Activate Listing & Publish Offer
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {currentStep === 5 && createdOffer && (
              <Card title="Step 6: Listing Live" style={{ border: '2px solid var(--primary-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <Alert
                    type="success"
                    showIcon
                    message="Lending Offer Activated & Public!"
                    description="Your contract is now live on the marketplace. Borrowers can accept the terms and lock XLM collateral to borrow."
                  />

                  {activateTx && (
                    <div style={{ padding: '12px', background: 'var(--border-light)', borderRadius: '6px', fontSize: '12px' }}>
                      <strong>Activation Tx Hash:</strong>{' '}
                      <a href={activateTx.explorerUrl} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)' }}>
                        {activateTx.txHash} <ExternalLink size={12} style={{ display: 'inline', marginLeft: 4 }} />
                      </a>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <Button size="large" onClick={() => navigate('/app/lender')}>
                      Go to Lender Dashboard
                    </Button>
                    <Button type="primary" size="large" onClick={() => navigate('/app/marketplace')}>
                      View on Marketplace
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </Form>
        </Col>

        {/* Right side yield & risk metrics preview */}
        <Col xs={24} lg={9}>
          <Card
            title="Lending Yield & Risk Preview"
            style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--border-light)' }}
            styles={{ body: { padding: '24px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ textAlign: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', display: 'block' }}>
                  PROJECTED INTEREST YIELD
                </span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--success-color)', fontFamily: 'var(--font-heading)' }}>
                  +${interestEarned.toFixed(2)}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                  in USDC stablecoins
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lending Principal:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>${amount.toLocaleString()} USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Term Duration:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{duration} Days</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Fixed Yield (APR):</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{apr}% APR</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Estimated Repayment:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>${totalRepayment.toFixed(2)} USDC</span>
                </div>
              </div>

              <div style={{ padding: '12px 14px', backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                  XLM COLLATERAL EXPECTATION
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Required Collateral:</span>
                    <span style={{ fontWeight: 700, color: '#E28743' }}>{reqCollateralXLM.toLocaleString()} XLM</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Collateral Value ($):</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>${reqCollateralVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Risk Rating Level:</span>
                    <Tag color={risk.color} style={{ margin: 0, fontWeight: 700, border: 'none', padding: '1px 6px', fontSize: '10px' }}>
                      {risk.label}
                    </Tag>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', textAlign: 'center' }}>
                Estimates calculated based on current Stellar Anchor Oracle Feed XLM Price: <strong>${xlmPrice.toFixed(4)} USDC</strong>.
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
