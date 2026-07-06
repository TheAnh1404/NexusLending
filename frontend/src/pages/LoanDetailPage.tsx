import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateRequiredCollateral, calculateRepaymentAmount, calculateHealthFactor, getRiskZone, formatCurrency } from '../utils/finance';
import { HealthFactorGauge } from '../components/common/HealthFactorGauge';
import { EmptyState } from '../components/common/CommonStates';
import { OfferStatusBadge } from '../components/common/OfferStatusBadge';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import {
  Card,
  Row,
  Col,
  Descriptions,
  Button,
  Slider,
  Typography,
  Timeline,
  Alert,
  Tag,
} from 'antd';
import {
  ArrowLeft,
  Activity,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const LoanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loanOffers, loans, oraclePrices } = useAppContext();

  // Find either in offers or active loans
  const offer = loanOffers.find((o) => o.id === id);
  const activeLoan = loans.find((l) => l.id === id);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;
  const xlmOracle = oraclePrices.find((p) => p.asset === 'XLM');

  // Slider state to simulate XLM price
  const [simulatedPrice, setSimulatedPrice] = useState<number>(xlmPrice);

  if (!offer && !activeLoan) {
    return (
      <EmptyState
        title="Loan Contract Not Found"
        description="We couldn't retrieve the specified loan ID from the Stellar blockchain state."
        action={
          <Button type="primary" onClick={() => navigate('/app/marketplace')}>
            Back to Marketplace
          </Button>
        }
      />
    );
  }

  // Common parameters
  const isOffer = !!offer;
  const isListedOffer = offer?.status === 'Active';
  const loanAmount = isOffer ? offer.amount : activeLoan!.amount;
  const apr = isOffer ? offer.apr : activeLoan!.apr;
  const duration = isOffer ? offer.duration : activeLoan!.duration;
  const maxLTV = isOffer ? offer.maxLTV : activeLoan!.maxLTV;
  const threshold = isOffer ? offer.liquidationThreshold : activeLoan!.liquidationThreshold;
  const bonus = isOffer ? offer.liquidationBonus : activeLoan!.liquidationBonus;
  const lender = isOffer ? offer.lender : activeLoan!.lender;
  const gracePeriod = isOffer ? offer.gracePeriod : 3;

  const requiredCollateralXLM = isOffer
    ? calculateRequiredCollateral(loanAmount, 1.0, xlmPrice, maxLTV)
    : activeLoan!.collateralAmount;

  const repaymentAmt = calculateRepaymentAmount(loanAmount, apr, duration);
  const interestAmt = repaymentAmt - loanAmount;

  // Health Factor Simulation calculations
  const simHF = calculateHealthFactor(
    requiredCollateralXLM,
    simulatedPrice,
    repaymentAmt, // use total repayment debt as denominator
    usdcPrice,
    threshold
  );

  const simRiskZone = getRiskZone(simHF);
  const priceChangePercent = ((simulatedPrice - xlmPrice) / xlmPrice) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <Button
          type="text"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)' }}
        >
          Back
        </Button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              CONTRACT ID: {id}
            </span>
            <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
              Loan Contract Details
            </Title>
          </div>
          <div>
            {isOffer && isListedOffer ? (
              <Button type="primary" size="large" onClick={() => navigate(`/app/borrow/${id}`)}>
                Accept Offer
              </Button>
            ) : isOffer ? (
              <OfferStatusBadge status={offer!.status} />
            ) : (
              <LoanStatusBadge status={activeLoan!.status} />
            )}
          </div>
        </div>
      </div>

      <Row gutter={[32, 32]}>
        {/* Left Side Info */}
        <Col xs={24} lg={15}>
          <Card title="Contract Parameters" styles={{ body: { padding: '24px' } }}>
            <Descriptions bordered column={1} labelStyle={{ width: '220px', fontWeight: 600 }}>
              <Descriptions.Item label="Lending Asset">
                <Text strong>USDC (Stellar Anchor Stablecoin)</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Principal Amount">
                <Text strong style={{ fontSize: '16px', color: 'var(--primary-color)' }}>
                  {formatCurrency(loanAmount, 'USDC')}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Lender Public Key">
                <Text style={{ fontFamily: 'var(--font-mono)' }}>{lender}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Fixed Interest Rate">
                <Text strong>{apr}% APR</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Loan Duration">
                <Text>{duration} Days (Lock Period)</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Collateral Asset">
                <Tag color="orange">XLM</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Escrow Collateral Locked">
                <Text strong>{requiredCollateralXLM.toLocaleString()} XLM</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Max LTV Allowed">
                <Text>{maxLTV}%</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Liquidation Threshold LTV">
                <Text style={{ color: 'var(--warning-color)', fontWeight: 600 }}>{threshold}%</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Liquidation Penalty Bonus">
                <Text style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{bonus}%</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Liquidation Grace Period">
                <Text>{gracePeriod} Days</Text>
              </Descriptions.Item>
              {!isOffer && (
                <Descriptions.Item label="Borrower Public Key">
                  <Text style={{ fontFamily: 'var(--font-mono)' }}>{activeLoan!.borrower}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card title="Collateral Repayment Schedule" style={{ marginTop: '24px' }} styles={{ body: { padding: '24px' } }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={8}>
                <div style={{ padding: '16px', background: 'var(--bg-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>PRINCIPAL</Text>
                  <Text strong style={{ fontSize: '18px' }}>${loanAmount.toLocaleString()}</Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ padding: '16px', background: 'var(--bg-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>ACCURED INTEREST</Text>
                  <Text strong style={{ fontSize: '18px', color: 'var(--primary-color)' }}>+${interestAmt.toFixed(2)}</Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ padding: '16px', background: 'var(--primary-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <Text style={{ fontSize: '12px', display: 'block', color: 'rgba(255,255,255,0.8)' }}>TOTAL REPAYMENT</Text>
                  <Text strong style={{ fontSize: '18px', color: 'white' }}>${repaymentAmt.toLocaleString()}</Text>
                </div>
              </Col>
            </Row>
          </Card>

          <Card title="Oracle Price" style={{ marginTop: '24px' }} styles={{ body: { padding: '24px' } }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <div className="metric-panel">
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                    XLM / USDC
                  </Text>
                  <Text strong style={{ fontSize: '18px' }}>${xlmPrice.toFixed(4)}</Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="metric-panel">
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                    24h Change
                  </Text>
                  <Text strong style={{ color: (xlmOracle?.change24h || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {(xlmOracle?.change24h || 0) >= 0 ? '+' : ''}{xlmOracle?.change24h || 0}%
                  </Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="metric-panel">
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase' }}>
                    Source
                  </Text>
                  <Text strong>{xlmOracle?.source || 'Stellar Anchor Feed'}</Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Right Side Simulator and Timeline */}
        <Col xs={24} lg={9}>
          {/* Health Factor Simulation */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} style={{ color: 'var(--primary-color)' }} />
                <span>Risk Simulator</span>
              </div>
            }
            styles={{ body: { padding: '24px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <HealthFactorGauge value={simHF} size={130} showMeaning />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <Text strong style={{ fontSize: '12px' }}>SIMULATE XLM PRICE:</Text>
                <Text strong style={{ color: priceChangePercent >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '12px' }}>
                  ${simulatedPrice.toFixed(4)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(1)}%)
                </Text>
              </div>
              <Slider
                min={0.05}
                max={0.25}
                step={0.005}
                value={simulatedPrice}
                onChange={setSimulatedPrice}
                tooltip={{ formatter: (val) => `$${val?.toFixed(4)}` }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>$0.0500 (Drop)</span>
                <span style={{ fontWeight: 600 }}>Live: ${xlmPrice.toFixed(4)}</span>
                <span>$0.2500 (Rise)</span>
              </div>
            </div>

            {simRiskZone === 'LIQUIDATION_PLANNING' ? (
              <Alert
                message="Liquidation Zone"
                description={`Under this price, the LTV exceeds the threshold and the Health Factor falls below 1.2 (${simHF}). The contract is vulnerable to open liquidation.`}
                type="error"
                showIcon
              />
            ) : simRiskZone === 'WARNING' ? (
              <Alert
                message="Warning Zone"
                description={`Health Factor is under 1.4 (${simHF}). Borrower should deposit additional XLM to avoid potential liquidation.`}
                type="warning"
                showIcon
              />
            ) : (
              <Alert
                message="Safe Zone"
                description={`Health Factor is safe at ${simHF}. The loan has adequate collateral backing.`}
                type="success"
                showIcon
              />
            )}
          </Card>

          {/* Timeline */}
          <Card title="Contract Timeline" style={{ marginTop: '24px' }} styles={{ body: { padding: '24px' } }}>
            <Timeline
              items={[
                {
                  color: 'green',
                  children: (
                    <div>
                      <Text strong style={{ fontSize: '13px' }}>Offer Funded & Active</Text>
                      <Paragraph style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                        Lender funds are locked in Vault/Escrow.
                      </Paragraph>
                    </div>
                  ),
                },
                {
                  color: isOffer ? 'gray' : 'blue',
                  children: (
                    <div>
                      <Text strong style={{ fontSize: '13px' }}>Borrower Acceptance</Text>
                      <Paragraph style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                        {isOffer ? 'Pending borrower acceptance.' : `Accepted by borrower on ${new Date(activeLoan!.borrowTime).toLocaleDateString()}.`}
                      </Paragraph>
                    </div>
                  ),
                },
                {
                  color: 'gray',
                  children: (
                    <div>
                      <Text strong style={{ fontSize: '13px' }}>Lock Period End</Text>
                      <Paragraph style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                        Borrower must make payment of ${repaymentAmt.toLocaleString()} USDC before maturity.
                      </Paragraph>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

