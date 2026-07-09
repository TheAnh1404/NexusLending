import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { isAdminWallet } from '../config/admin';
import {
  DEFAULT_GRACE_PERIOD_DAYS,
  calculateRequiredCollateral,
  calculateRepaymentAmount,
  calculateHealthFactor,
  formatCurrency,
  getGracePeriodDaysRemaining,
  getRiskZone,
  isLiquidatable as checkLiquidatable,
} from '../utils/finance';
import { HealthFactorGauge } from '../components/common/HealthFactorGauge';
import { EmptyState } from '../components/common/CommonStates';
import { OfferStatusBadge } from '../components/common/OfferStatusBadge';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import { AddCollateralModal } from '../components/common/AddCollateralModal';
import { PartialRepaymentModal } from '../components/common/PartialRepaymentModal';
import { CONTRACTS, NETWORK } from '../services/soroban/config';
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
  Table,
  Form,
  App,
} from 'antd';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Coins,
  ArrowRight,
  Flame,
  TrendingDown,
} from 'lucide-react';

const { Title, Text } = Typography;

export const LoanDetailPage: React.FC = () => {
  const id = useParams<{ id: string }>().id || '';
  const navigate = useNavigate();
  const { message } = App.useApp();
  const {
    loanOffers,
    loans,
    oraclePrices,
    wallet,
    fundOffer,
    activateOffer,
    cancelOffer,
    activateLoan,
    addCollateral,
    repayLoan,
    recalculateAllHealthFactors,
    transactions,
  } = useAppContext();

  // Find either in offers or active loans
  const offer = loanOffers.find((o) => o.id === id);
  const activeLoan = loans.find((l) => l.id === id);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

  // Slider state to simulate XLM price
  const [simulatedPrice, setSimulatedPrice] = useState<number>(xlmPrice);
  const [loading, setLoading] = useState<boolean>(false);

  // Modals state
  const [collateralModalOpen, setCollateralModalOpen] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [collateralForm] = Form.useForm();
  const [repayForm] = Form.useForm();

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
  const loanAmount = isOffer ? offer!.amount : activeLoan!.amount;
  const apr = isOffer ? offer.apr : activeLoan!.apr;
  const duration = isOffer ? offer.duration : activeLoan!.duration;
  const maxLTV = isOffer ? offer.maxLTV : activeLoan!.maxLTV;
  const threshold = isOffer ? offer.liquidationThreshold : activeLoan!.liquidationThreshold;
  const bonus = isOffer ? offer.liquidationBonus : activeLoan!.liquidationBonus;
  const lender = isOffer ? offer.lender : activeLoan!.lender;

  const requiredCollateralXLM = isOffer
    ? calculateRequiredCollateral(loanAmount, 1.0, xlmPrice, maxLTV)
    : activeLoan!.collateralAmount;

  const repaymentAmt = calculateRepaymentAmount(loanAmount, apr, duration);
  const interestAmt = repaymentAmt - loanAmount;

  // Health Factor Simulation calculations
  const simHF = calculateHealthFactor(
    requiredCollateralXLM,
    simulatedPrice,
    repaymentAmt,
    usdcPrice,
    threshold
  );

  const simRiskZone = getRiskZone(simHF);
  const priceChangePercent = ((simulatedPrice - xlmPrice) / xlmPrice) * 100;

  // Role checks
  const isUserBorrower = activeLoan && wallet.connected && wallet.address === activeLoan.borrower;
  const isUserLender = wallet.connected && wallet.address === lender;
  const isAdmin = isAdminWallet(wallet.address);

  // Actions
  const handleFundOffer = async () => {
    try {
      setLoading(true);
      await fundOffer(offer!.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateOffer = async () => {
    try {
      setLoading(true);
      await activateOffer(offer!.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOffer = async () => {
    try {
      setLoading(true);
      await cancelOffer(offer ? offer.id : activeLoan!.offerId);
      message.success('Offer cancelled. USDC funds returned to wallet.');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLoan = async () => {
    if (!activeLoan) return;
    try {
      setLoading(true);
      await activateLoan(activeLoan.id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCollateralSubmit = async (amount: number) => {
    if (!activeLoan || amount <= 0) return;
    try {
      setLoading(true);
      await addCollateral(activeLoan.id, amount);
      setCollateralModalOpen(false);
      collateralForm.resetFields();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRepaySubmit = async (amount: number, isFullRepay: boolean) => {
    if (!activeLoan) return;
    try {
      setLoading(true);
      await repayLoan(activeLoan.id, amount, isFullRepay);
      setRepayModalOpen(false);
      repayForm.resetFields();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      await recalculateAllHealthFactors();
      message.success('Health parameters synchronized with latest anchor price feeds.');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions for this specific contract
  const matchesTxs = transactions.filter(
    (tx) => tx.loanId === id || tx.offerId === id || (activeLoan && tx.loanId === activeLoan.id)
  );

  const creationTx = matchesTxs.find(
    (tx) => tx.type === 'CREATE_OFFER' || tx.type === 'ACCEPT_OFFER' || tx.type === 'ACTIVATE_LOAN'
  ) || matchesTxs[matchesTxs.length - 1];

  const activityColumns = [
    {
      title: 'Action',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => {
        const colorMap: Record<string, string> = {
          CREATE_OFFER: 'gold',
          FUND_OFFER: 'gold',
          ACTIVATE_OFFER: 'green',
          CANCEL_OFFER: 'default',
          ACCEPT_OFFER: 'blue',
          BORROW_LOAN: 'blue',
          ACTIVATE_LOAN: 'cyan',
          ADD_COLLATERAL: 'cyan',
          PARTIAL_REPAY: 'green',
          FULL_REPAY: 'green',
          LIQUIDATE: 'red',
        };

        return <Tag color={colorMap[text] ?? 'default'} style={{ fontWeight: 700 }}>{text.replace(/_/g, ' ')}</Tag>;
      },
    },
    {
      title: 'Caller',
      dataIndex: 'user',
      key: 'user',
      render: (text: string) => <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{text.slice(0, 6)}...{text.slice(-6)}</Text>,
    },
    {
      title: 'Ledger Hash / Explorer',
      dataIndex: 'txHash',
      key: 'txHash',
      render: (hash: string, record: any) => {
        if (!hash) return <Text type="secondary">-</Text>;
        return (
          <a href={record.explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {hash.slice(0, 6)}...{hash.slice(-6)} <ExternalLink size={11} />
          </a>
        );
      },
    },
    {
      title: 'Block',
      dataIndex: 'ledger',
      key: 'ledger',
      render: (val: any) => val ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>#{val}</span> : '-',
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (val: string) => <span style={{ fontSize: '12px' }}>{val}</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header Info Block */}
      <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <Button
          type="text"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)' }}
        >
          Back
        </Button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>CONTRACT ID: {id}</span>
              {creationTx?.txHash && (
                <>
                  <span>•</span>
                  <a href={creationTx.explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--primary-color)' }}>
                    View on Stellar Expert <ExternalLink size={12} />
                  </a>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Title level={3} style={{ margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                {isOffer ? 'Lending Offer Details' : `USDC / XLM Loan Contract`}
              </Title>
              {isOffer ? (
                <OfferStatusBadge status={offer!.status} />
              ) : (
                <LoanStatusBadge status={activeLoan!.status} />
              )}
            </div>
            <div style={{ display: 'flex', gap: '20px', marginTop: '8px', flexWrap: 'wrap', fontSize: '13px' }}>
              <span>Lender: <Text style={{ fontFamily: 'var(--font-mono)' }}>{lender.slice(0, 8)}...{lender.slice(-8)}</Text></span>
              {!isOffer && (
                <span>Borrower: <Text style={{ fontFamily: 'var(--font-mono)' }}>{activeLoan!.borrower.slice(0, 8)}...{activeLoan!.borrower.slice(-8)}</Text></span>
              )}
              <span>Asset Pair: <Tag color="blue">USDC / XLM</Tag></span>
            </div>
          </div>
          {!isOffer && (
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>CURRENT HEALTH FACTOR</Text>
              <div style={{ fontSize: '24px', fontWeight: 800, color: activeLoan!.healthFactor >= 1.4 ? 'var(--success-color)' : activeLoan!.healthFactor >= 1.2 ? 'var(--warning-color)' : 'var(--danger-color)' }}>
                {activeLoan!.healthFactor.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column: Specs cards */}
        <Col xs={24} lg={16}>
          {/* Action Call Widget */}
          <Card
            title="Allowed Actions"
            style={{ marginBottom: '24px', border: '2px solid var(--primary-color)', backgroundColor: 'rgba(79, 70, 229, 0.01)' }}
            styles={{ body: { padding: '20px' } }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '12px' }}>
                <RefreshCw size={20} className="spin-animation" style={{ color: 'var(--primary-color)' }} />
                <Text style={{ display: 'block', marginTop: '8px' }}>Submitting ledger transaction...</Text>
              </div>
            ) : isOffer && offer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {offer.status === 'Draft' && isUserLender && (
                  <Alert
                    type="info"
                    showIcon
                    message="USDC deposit required"
                    description={
                      <div>
                        Fund the escrow vault with {loanAmount.toLocaleString()} USDC to activate this offer.
                        <div style={{ marginTop: '12px' }}>
                          <Button type="primary" onClick={handleFundOffer} icon={<Coins size={14} style={{ marginRight: 6 }} />}>
                            Fund Offer Escrow
                          </Button>
                        </div>
                      </div>
                    }
                  />
                )}
                {offer.status === 'Funding' && isUserLender && (
                  <Alert
                    type="info"
                    showIcon
                    message="Ready for publication"
                    description={
                      <div>
                        Escrow funded successfully. Deploy to public marketplace.
                        <div style={{ marginTop: '12px' }}>
                          <Button type="primary" onClick={handleActivateOffer} icon={<ArrowRight size={14} style={{ marginRight: 6 }} />}>
                            Activate Marketplace Listing
                          </Button>
                        </div>
                      </div>
                    }
                  />
                )}
                {offer.status === 'Active' && !isUserLender && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <Text>Accept terms and draw stablecoins:</Text>
                    <Button type="primary" onClick={() => navigate(`/app/borrow/${offer.id}`)}>
                      Accept & Borrow
                    </Button>
                  </div>
                )}
                {['Draft', 'Funding', 'Active'].includes(offer.status || '') && isUserLender && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary">Withdraw USDC funds and cancel terms:</Text>
                    <Button danger size="small" onClick={handleCancelOffer}>
                      Cancel Offer
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              activeLoan && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeLoan.status === 'PendingCollateral' && (
                  <div>
                    {isUserBorrower ? (
                      <Alert
                        type="warning"
                        showIcon
                        message="Collateral Escrow Lock Required"
                        description={
                          <div>
                            USDC funds are held in escrow. Lock your XLM collateral to activate the loan and draw USDC.
                            <div style={{ marginTop: '12px' }}>
                              <Button type="primary" onClick={handleActivateLoan} icon={<CheckCircle2 size={16} style={{ marginRight: 6 }} />}>
                                Activate Loan & Lock XLM
                              </Button>
                            </div>
                          </div>
                        }
                      />
                    ) : (
                      <Alert
                        type="warning"
                        showIcon
                        message="Awaiting Borrower Activation"
                        description="Terms accepted. The contract is pending borrower collateral lock."
                      />
                    )}
                  </div>
                )}

                {['Active', 'Warning', 'LiquidationPlanning', 'Expired', 'Defaulted'].includes(activeLoan.status) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeLoan.status === 'Expired' && (
                      <Alert
                        type="warning"
                        showIcon
                        message="Repayment overdue"
                        description={`This loan has passed maturity. Repay within ${getGracePeriodDaysRemaining(activeLoan.dueDate, activeLoan.gracePeriod ?? DEFAULT_GRACE_PERIOD_DAYS)} days to avoid default and liquidation eligibility regardless of Health Factor.`}
                      />
                    )}
                    {activeLoan.status === 'Defaulted' && (
                      <Alert
                        type="error"
                        showIcon
                        message="Defaulted: liquidation eligible"
                        description="The 7-day grace period has ended. This loan can be liquidated regardless of Health Factor until it is fully repaid or liquidated."
                      />
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {isUserBorrower && (
                      <>
                        {activeLoan.status !== 'Defaulted' && (
                          <Button type="primary" onClick={() => setCollateralModalOpen(true)}>
                            Add XLM Collateral
                          </Button>
                        )}
                        <Button onClick={() => setRepayModalOpen(true)}>
                          Repay USDC Debt
                        </Button>
                      </>
                    )}
                    {checkLiquidatable(activeLoan.healthFactor, activeLoan.status) && (
                      <Button
                        type="primary"
                        danger
                        icon={<Flame size={14} style={{ marginRight: 4 }} />}
                        onClick={() => navigate(`/app/liquidation/${activeLoan.id}`)}
                      >
                        Liquidate distressed Position
                      </Button>
                    )}
                    {isAdmin && (
                      <Button onClick={handleRefresh} icon={<RefreshCw size={14} style={{ marginRight: 4 }} />}>
                        Refresh Health & Status
                      </Button>
                    )}
                    </div>
                  </div>
                )}

                {activeLoan.status === 'Repaid' && (
                  <Alert
                    type="success"
                    showIcon
                    message="Lending Contract Settled"
                    description="Repayment has been completed. Accrued interest was transferred directly to the lender's wallet address on confirmation."
                  />
                )}
                {activeLoan.status === 'Liquidated' && (
                  <Alert
                    type="error"
                    showIcon
                    message="Loan Position Liquidated"
                    description="Contract closed. Distressed debt paid off by a liquidator, and locked XLM seized."
                  />
                )}
              </div>
            )
          )}
          </Card>

          {/* Main 4 Cards Details */}
          <Row gutter={[24, 24]}>
            {/* Card 1: Debt */}
            <Col xs={24} md={12}>
              <Card title="1. Debt Specifications" style={{ height: '100%' }}>
                <Descriptions column={1} size="small" bordered styles={{ label: { fontWeight: 600 } }}>
                  <Descriptions.Item label="Principal Amount">
                    <Text strong>{formatCurrency(loanAmount, 'USDC')}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Interest yield">
                    <Text strong style={{ color: 'var(--success-color)' }}>+${interestAmt.toFixed(2)} USDC</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Accrued Debt Due">
                    <Text strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(repaymentAmt, 'USDC')}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Fixed APR">
                    <Text>{apr}% APR</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Due Date">
                    {!isOffer ? (
                      <span>{new Date(activeLoan!.dueDate).toLocaleDateString()} ({duration} Days)</span>
                    ) : (
                      <span>{duration} Days Term</span>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* Card 2: Collateral */}
            <Col xs={24} md={12}>
              <Card title="2. Collateral Specifications" style={{ height: '100%' }}>
                <Descriptions column={1} size="small" bordered styles={{ label: { fontWeight: 600 } }}>
                  <Descriptions.Item label="Collateral Locked">
                    <Text strong>{requiredCollateralXLM.toLocaleString()} XLM</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Oracle XLM Feed">
                    <Text style={{ fontFamily: 'var(--font-mono)' }}>${xlmPrice.toFixed(4)} USDC</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Collateral Value">
                    <Text strong>${(requiredCollateralXLM * xlmPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Est. Liquidation Price">
                    <Text strong style={{ color: 'var(--danger-color)' }}>
                      ${(repaymentAmt / (requiredCollateralXLM * (threshold / 100))).toFixed(4)} USDC
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* Card 3: Risk Parameters */}
            <Col xs={24} md={12}>
              <Card title="3. Risk & Thresholds" style={{ height: '100%' }}>
                <Descriptions column={1} size="small" bordered styles={{ label: { fontWeight: 600 } }}>
                  <Descriptions.Item label="Max Allowed LTV">
                    <Text>{maxLTV}% LTV</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Liquidation Trigger">
                    <Text style={{ color: 'var(--warning-color)', fontWeight: 600 }}>{threshold}% LTV</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Liquidation Penalty">
                    <Text style={{ color: 'var(--danger-color)', fontWeight: 600 }}>+{bonus}% Collateral Seized</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Min Target HF">
                    <Text>{isOffer ? offer.minHealthFactor.toFixed(2) : activeLoan!.minHealthFactor?.toFixed(2) || '1.40'}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Liquidation HF Limit">
                    <Text strong style={{ color: 'var(--danger-color)' }}>1.20 HF</Text>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>

            {/* Card 4: Blockchain Configuration */}
            <Col xs={24} md={12}>
              <Card title="4. Blockchain Configuration" style={{ height: '100%' }}>
                <Descriptions column={1} size="small" bordered styles={{ label: { fontWeight: 600, fontSize: '11px' }, content: { fontSize: '11px', fontFamily: 'var(--font-mono)' } }}>
                  {creationTx?.txHash && (
                    <Descriptions.Item label="Creation Tx">
                      <a href={creationTx.explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-color)' }}>
                        {creationTx.txHash.slice(0, 8)}...{creationTx.txHash.slice(-8)} <ExternalLink size={11} />
                      </a>
                    </Descriptions.Item>
                  )}
                  {creationTx?.ledger && (
                    <Descriptions.Item label="Ledger Height">
                      <span>#{creationTx.ledger}</span>
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="Marketplace Contract">
                    <Text copyable={{ text: CONTRACTS.marketplace }}>{CONTRACTS.marketplace.slice(0, 6)}...{CONTRACTS.marketplace.slice(-6)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Loan Manager Contract">
                    <Text copyable={{ text: CONTRACTS.loanManager }}>{CONTRACTS.loanManager.slice(0, 6)}...{CONTRACTS.loanManager.slice(-6)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Vault Contract">
                    <Text copyable={{ text: CONTRACTS.vault }}>{CONTRACTS.vault.slice(0, 6)}...{CONTRACTS.vault.slice(-6)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Oracle Contract">
                    <Text copyable={{ text: CONTRACTS.oracle }}>{CONTRACTS.oracle.slice(0, 6)}...{CONTRACTS.oracle.slice(-6)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Network / RPC Mode" labelStyle={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                    <Tag color="purple">{NETWORK.toUpperCase()}</Tag> (Soroban WASM)
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Right Column: Simulator & Timeline */}
        <Col xs={24} lg={8}>
          {/* Simulator */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={16} style={{ color: 'var(--primary-color)' }} />
                <span>Isolated Vault Simulator</span>
              </div>
            }
            style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--border-light)' }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <HealthFactorGauge value={simHF} size={110} showMeaning />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <Text strong style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SIMULATE XLM DROP:</Text>
                <Text strong style={{ color: priceChangePercent >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  ${simulatedPrice.toFixed(4)} ({priceChangePercent.toFixed(1)}%)
                </Text>
              </div>
              <Slider
                min={Math.max(0.01, xlmPrice - 0.1)}
                max={xlmPrice + 0.1}
                step={0.005}
                value={simulatedPrice}
                onChange={setSimulatedPrice}
                tooltip={{ formatter: (val) => `$${val?.toFixed(4)}` }}
              />
            </div>

            {simRiskZone === 'LIQUIDATION_PLANNING' ? (
              <Alert message="Liquidation Risk" description="Health Factor < 1.2. Liquidators can seize collateral." type="error" showIcon />
            ) : simRiskZone === 'WARNING' ? (
              <Alert message="LTV Warning" description="Health Factor < 1.4. Margin is narrow." type="warning" showIcon />
            ) : (
              <Alert message="Collateral Safe" description="Safety margin is sufficient." type="success" showIcon />
            )}
          </Card>

          {/* Dynamic Blockchain Timeline */}
          <Card title="Contract On-Chain Lifecycle" style={{ marginTop: '24px', border: '1px solid var(--border-color)' }} styles={{ body: { padding: '24px 32px' } }}>
            {matchesTxs.length === 0 ? (
              <EmptyState title="No transactions yet" description="This contract has no recorded ledger states." />
            ) : (
              <Timeline
                items={matchesTxs.map((tx) => ({
                  color: tx.status === 'SUCCESS' || !tx.status ? 'green' : 'red',
                  children: (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: '13px' }}>{tx.type.replace(/_/g, ' ')}</Text>
                        <Tag color={tx.status === 'SUCCESS' || !tx.status ? 'success' : 'error'} style={{ fontSize: '9px', margin: 0 }}>
                          {tx.status ?? 'CONFIRMED'}
                        </Tag>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', fontSize: '11px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {tx.txHash && (
                          <a href={tx.explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '2px', fontFamily: 'var(--font-mono)' }}>
                            {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-6)} <ExternalLink size={10} />
                          </a>
                        )}
                        {tx.ledger && <span>Block #{tx.ledger}</span>}
                        <span>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Transaction History ledger */}
      <Card title="Full Contract Transaction Ledger" style={{ border: '1px solid var(--border-color)' }} styles={{ body: { padding: 0 } }}>
        <Table columns={activityColumns} dataSource={matchesTxs.map((item, idx) => ({ ...item, key: idx }))} pagination={false} />
      </Card>

      {/* Modals */}
      {activeLoan && (
        <>
          <AddCollateralModal
            open={collateralModalOpen}
            loan={activeLoan}
            wallet={wallet}
            form={collateralForm}
            xlmPrice={xlmPrice}
            usdcPrice={usdcPrice}
            onCancel={() => setCollateralModalOpen(false)}
            onConfirm={handleAddCollateralSubmit}
          />
          <PartialRepaymentModal
            open={repayModalOpen}
            loan={activeLoan}
            wallet={wallet}
            form={repayForm}
            xlmPrice={xlmPrice}
            usdcPrice={usdcPrice}
            onCancel={() => setRepayModalOpen(false)}
            onConfirm={handleRepaySubmit}
          />
        </>
      )}
    </div>
  );
};
