import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateRequiredCollateral, calculateRepaymentAmount } from '../utils/finance';
import { RiskBadge } from '../components/common/RiskBadge';
import { OfferStatusBadge } from '../components/common/OfferStatusBadge';
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
} from 'antd';
import { Info, HelpCircle, FilePlus, ChevronLeft } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

export const CreateLoanPage: React.FC = () => {
  const { createOffer, fundOffer, activateOffer, oraclePrices } = useAppContext();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [createdOffer, setCreatedOffer] = useState<LoanOffer | null>(null);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // Live preview state values
  const [amount, setAmount] = useState<number>(5000);
  const [apr, setApr] = useState<number>(8.0);
  const [duration, setDuration] = useState<number>(60);
  const [maxLtv, setMaxLtv] = useState<number>(60);
  const [liquidationThreshold, setLiquidationThreshold] = useState<number>(75);
  const [liquidationBonus, setLiquidationBonus] = useState<number>(10);
  const [minHealthFactor, setMinHealthFactor] = useState<number>(1.4);

  // Calculations for live preview
  const interestEarned = amount * (apr / 100) * (duration / 365);
  const totalRepayment = calculateRepaymentAmount(amount, apr, duration);
  const reqCollateralXLM = calculateRequiredCollateral(amount, 1.0, xlmPrice, maxLtv);
  const reqCollateralVal = reqCollateralXLM * xlmPrice;

  const onFinish = async (values: any) => {
    const created = await createOffer({
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
      description: values.description || 'Custom lender terms created on-chain.',
    });
    if (created) {
      setCreatedOffer(created);
    }
  };

  const handleFundCreatedOffer = async () => {
    if (!createdOffer) return;
    const funded = await fundOffer(createdOffer.id);
    if (funded) setCreatedOffer(funded);
  };

  const handleActivateCreatedOffer = async () => {
    if (!createdOffer) return;
    const active = await activateOffer(createdOffer.id);
    if (active) setCreatedOffer(active);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <Button
          type="text"
          icon={<ChevronLeft size={16} />}
          onClick={() => navigate('/app/marketplace')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)' }}
        >
          Back to Marketplace
        </Button>
        <Title level={2} style={{ margin: '8px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
          Create Loan Offer
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Create fixed-rate lender terms, fund the offer, then activate it before borrowers can accept.
        </Paragraph>
      </div>

      {createdOffer && (
        <Alert
          type={createdOffer.status === 'Active' ? 'success' : 'info'}
          showIcon
          message={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Offer {createdOffer.id} <OfferStatusBadge status={createdOffer.status} />
            </span>
          }
          description={
            createdOffer.status === 'Draft'
              ? 'Next step: fund this offer to lock lender funds in Vault/Escrow.'
              : createdOffer.status === 'Funding'
                ? 'Funds are locked. Activate the offer to list it in the marketplace.'
                : 'Offer is Active and visible in the marketplace.'
          }
          action={
            createdOffer.status === 'Draft' ? (
              <Button type="primary" onClick={handleFundCreatedOffer}>
                Fund Offer
              </Button>
            ) : createdOffer.status === 'Funding' ? (
              <Button type="primary" onClick={handleActivateCreatedOffer}>
                Activate Offer
              </Button>
            ) : (
              <Button onClick={() => navigate('/app/marketplace')}>
                View Marketplace
              </Button>
            )
          }
        />
      )}

      <Row gutter={[32, 32]}>
        {/* Left Form */}
        <Col xs={24} lg={15}>
          <Card title="Loan Offer Parameters" styles={{ body: { padding: '32px' } }}>
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
                gracePeriod: 3,
                minHealthFactor,
                description: '',
              }}
              onFinish={onFinish}
              onValuesChange={(_, all) => {
                if (all.amount !== undefined) setAmount(all.amount || 0);
                if (all.apr !== undefined) setApr(all.apr || 0);
                if (all.duration !== undefined) setDuration(all.duration || 0);
                if (all.maxLtv !== undefined) setMaxLtv(all.maxLtv || 0);
                if (all.liquidationThreshold !== undefined) setLiquidationThreshold(all.liquidationThreshold || 0);
                if (all.liquidationBonus !== undefined) setLiquidationBonus(all.liquidationBonus || 0);
                if (all.minHealthFactor !== undefined) setMinHealthFactor(all.minHealthFactor || 1.4);
              }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Lending Asset" name="asset" rules={[{ required: true }]}>
                    <Select disabled size="large">
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
                    <InputNumber min={100} max={100000} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label={
                      <span>
                        Fixed Interest Rate (APR %)&nbsp;
                        <Tooltip title="Annual Percentage Rate locked for this contract.">
                          <HelpCircle size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </span>
                    }
                    name="apr"
                    rules={[
                      { required: true, message: 'Please enter APR' },
                      { type: 'number', min: 0.01, message: 'APR must be greater than 0' },
                    ]}
                  >
                    <InputNumber min={1} max={30} step={0.1} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Loan Duration (Days)"
                    name="duration"
                    rules={[
                      { required: true, message: 'Please enter duration' },
                      { type: 'number', min: 1, message: 'Duration must be greater than 0' },
                    ]}
                  >
                    <InputNumber min={7} max={365} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Accepted Collateral Asset" name="collateralAsset" rules={[{ required: true }]}>
                    <Select disabled size="large">
                      <Option value="XLM">XLM (Stellar Lumens)</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label={
                      <span>
                        Max Loan-To-Value (LTV %)&nbsp;
                        <Tooltip title="Maximum percentage of debt value relative to collateral value allowed at borrowing.">
                          <HelpCircle size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </span>
                    }
                    name="maxLtv"
                    rules={[
                      { required: true, message: 'Required' },
                      { type: 'number', min: 1, message: 'Max LTV must be greater than 0' },
                    ]}
                  >
                    <InputNumber min={10} max={90} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label={
                      <span>
                        Liquidation LTV Threshold (%)&nbsp;
                        <Tooltip title="Collateral LTV ratio at which the loan becomes liquidatable. Must be at least Max LTV.">
                          <HelpCircle size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
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
                          return Promise.reject(new Error('Threshold must be greater than or equal to Max LTV'));
                        },
                      }),
                    ]}
                  >
                    <InputNumber min={20} max={95} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                  <Form.Item
                    label={
                      <span>
                        Liquidation Bonus (%)&nbsp;
                        <Tooltip title="Bonus collateral percentage awarded to the liquidator during liquidations.">
                          <HelpCircle size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </span>
                    }
                    name="liquidationBonus"
                    rules={[
                      { required: true, message: 'Required' },
                      { type: 'number', min: 0, message: 'Bonus must be zero or greater' },
                    ]}
                  >
                    <InputNumber min={1} max={25} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                  <Form.Item
                    label={
                      <span>
                        Grace Period (Days)&nbsp;
                        <Tooltip title="Days a borrower has to restore Health Factor after falling below 1.2 before liquidation execution.">
                          <HelpCircle size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </span>
                    }
                    name="gracePeriod"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <InputNumber min={0} max={15} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item
                    label={
                      <span>
                        Minimum Health Factor&nbsp;
                        <Tooltip title="Recommended safe threshold. SAFE starts at 1.4 across the app.">
                          <HelpCircle size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} />
                        </Tooltip>
                      </span>
                    }
                    name="minHealthFactor"
                    rules={[{ required: true, message: 'Required' }]}
                  >
                    <InputNumber min={1.2} max={3} step={0.05} style={{ width: '100%' }} size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Public Loan Description (Optional)" name="description">
                <Input.TextArea placeholder="Describe special terms, target borrower profile, or escrow specifications..." rows={4} />
              </Form.Item>

              <Form.Item style={{ margin: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  icon={<FilePlus size={18} style={{ marginRight: 6 }} />}
                  style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Create Draft Offer
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Right Preview Card */}
        <Col xs={24} lg={9}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={16} style={{ color: 'var(--primary-color)' }} />
                <span>Live Offer Preview</span>
              </div>
            }
            styles={{ body: { padding: '24px' } }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                LENDING OFFER
              </span>
              <Title level={3} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--primary-color)', fontFamily: 'var(--font-heading)' }}>
                ${amount.toLocaleString()} USDC
              </Title>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                Interest yield locked on creation
              </Text>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Required Collateral:</Text>
                <Text strong style={{ color: '#E28743' }}>{reqCollateralXLM.toLocaleString()} XLM</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Collateral USD Value:</Text>
                <Text strong>${reqCollateralVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Interest APR:</Text>
                <Text strong style={{ color: 'var(--primary-color)' }}>{apr}% Fixed</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Est. Yield Earned:</Text>
                <Text strong style={{ color: 'var(--success-color)' }}>+${interestEarned.toFixed(2)} USDC</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                <Text type="secondary">Total Borrower Repay:</Text>
                <Text strong>${totalRepayment.toLocaleString()}</Text>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-color)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>MAX LTV:</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{maxLtv}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>LIQ. THRESHOLD:</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warning-color)' }}>{liquidationThreshold}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>LIQ. BONUS:</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger-color)' }}>{liquidationBonus}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>MIN HEALTH FACTOR:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text strong>{minHealthFactor.toFixed(2)}</Text>
                  <RiskBadge healthFactor={minHealthFactor} />
                </span>
              </div>
            </div>
            <div style={{ marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              * Creating an offer only records lender terms. Funding locks ${amount.toLocaleString()} USDC in Vault/Escrow; activation lists it in the marketplace.
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

