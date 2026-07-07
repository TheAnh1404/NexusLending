import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateHealthFactor, formatCurrency, isLiquidatable } from '../utils/finance';
import { HealthFactorGauge } from '../components/common/HealthFactorGauge';
import { EmptyState } from '../components/common/CommonStates';
import { ConfirmActionModal } from '../components/common/ConfirmActionModal';
import { TransactionReceiptCard } from '../components/common/TransactionReceiptCard';
import {
  Card,
  Row,
  Col,
  Descriptions,
  Button,
  Typography,
  Alert,
  InputNumber,
} from 'antd';
import { Flame, ArrowLeft, Sparkles } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const LiquidationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loans, oraclePrices, wallet, liquidateLoan, transactions } = useAppContext();

  const loan = loans.find((l) => l.id === id);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [repayAmount, setRepayAmount] = useState(0);
  const maxRepayAmount = loan ? Math.round(loan.outstandingDebt * 0.5 * 100) / 100 : 0;

  // Stepper transaction status
  const [txStatus, setTxStatus] = useState<'preparing' | 'signing' | 'submitting' | 'confirming' | 'confirmed' | 'failed' | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    if (loan) {
      setRepayAmount(Math.round(loan.outstandingDebt * 0.5 * 100) / 100);
    }
  }, [loan]);

  if (!loan) {
    return (
      <EmptyState
        title="Active Loan Contract Not Found"
        description="We couldn't retrieve the specified active loan ID from the blockchain state."
        action={
          <Button type="primary" onClick={() => navigate('/app/liquidation')}>
            Back to Liquidation Center
          </Button>
        }
      />
    );
  }

  // Liquidation math
  // Repay up to 50% of the loan outstanding debt (standard DeFi close factor limit).
  const collateralValueToReceive = repayAmount * (1 + loan.liquidationBonus / 100);
  const collateralToReceive = Math.min(loan.collateralAmount, collateralValueToReceive / xlmPrice);

  const remainingDebt = Math.max(0, loan.outstandingDebt - repayAmount);
  const remainingCollateral = Math.max(0, loan.collateralAmount - collateralToReceive);

  const estHFAfter = calculateHealthFactor(
    remainingCollateral,
    xlmPrice,
    remainingDebt,
    usdcPrice,
    loan.liquidationThreshold
  );

  const handleConfirmLiquidation = () => {
    setConfirmModalVisible(true);
  };

  const handleExecuteLiquidation = async () => {
    if (!canExecute) {
      throw new Error('Liquidation validation failed');
    }
    try {
      setConfirmModalVisible(false);
      setTxStatus('preparing');
      
      // Simulate/trigger ledger transaction pipeline stages
      await new Promise(r => setTimeout(r, 600));
      setTxStatus('signing');
      
      await new Promise(r => setTimeout(r, 800));
      setTxStatus('submitting');
      
      await new Promise(r => setTimeout(r, 800));
      setTxStatus('confirming');
      
      await liquidateLoan(loan.id, repayAmount);
      setTxStatus('confirmed');
    } catch (e: any) {
      setErrorDetails(e.message || 'Soroban transaction failed.');
      setTxStatus('failed');
    }
  };

  const eligible = isLiquidatable(loan.healthFactor, loan.status);
  const hasValidRepayAmount = repayAmount > 0 && repayAmount <= maxRepayAmount + 0.01;
  const canExecute = eligible && hasValidRepayAmount && wallet.balanceUSDC >= repayAmount;

  // Retrieve hash of latest liquidation tx for this loan
  const matchedTx = transactions.find(
    (tx) => tx.type === 'LIQUIDATE' && tx.loanId === loan.id
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div>
        <Button
          type="text"
          icon={<ArrowLeft size={16} />}
          onClick={() => navigate('/app/liquidation')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)' }}
        >
          Back to Liquidation Center
        </Button>
        <Title level={2} style={{ margin: '8px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
          Plan Partial Liquidation
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Review liquidation terms, repay debt in USDC, and receive collateralized XLM with a bonus incentive.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Side: Summary of Loan */}
        <Col xs={24} lg={15}>
          <Card title="Liquidation Review" styles={{ body: { padding: '28px' } }}>
            <Descriptions
              bordered
              column={1}
              styles={{ label: { width: '220px', fontWeight: 600 } }}
              items={[
                {
                  key: 'contractId',
                  label: 'Contract ID',
                  children: <Text style={{ fontFamily: 'var(--font-mono)' }}>{loan.id}</Text>,
                },
                {
                  key: 'borrower',
                  label: 'Borrower Address',
                  children: <Text style={{ fontFamily: 'var(--font-mono)' }}>{loan.borrower}</Text>,
                },
                {
                  key: 'lender',
                  label: 'Lender Address',
                  children: <Text style={{ fontFamily: 'var(--font-mono)' }}>{loan.lender}</Text>,
                },
                {
                  key: 'healthFactor',
                  label: 'Current Health Factor',
                  children: <Text strong style={{ color: 'var(--danger-color)' }}>{loan.healthFactor.toFixed(2)}</Text>,
                },
                {
                  key: 'outstandingDebt',
                  label: 'Total Outstanding Debt',
                  children: <Text strong>{formatCurrency(loan.outstandingDebt, 'USDC')}</Text>,
                },
                {
                  key: 'collateral',
                  label: 'Escrow Locked Collateral',
                  children: <Text strong>{loan.collateralAmount.toLocaleString()} XLM</Text>,
                },
              ]}
            />

            <Alert
              message="Partial Liquidation Protocol Rule"
              description="To prevent total default of borrower assets, the liquidator executes a partial liquidation. The liquidator can repay up to 50% of the active debt and claim an equivalent amount of collateral plus the liquidation bonus."
              type="info"
              showIcon
              style={{ marginTop: '24px' }}
            />
          </Card>

          <Card title="Liquidation Execution Math" style={{ marginTop: '24px' }} styles={{ body: { padding: '24px' } }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={8}>
                <div style={{ padding: '16px', background: 'var(--bg-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>REPAYMENT IN USDC</Text>
                  <Text strong style={{ fontSize: '20px', color: 'var(--danger-color)' }}>-${repayAmount.toFixed(2)}</Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ padding: '16px', background: 'var(--bg-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>COLLATERAL RECEIVED</Text>
                  <Text strong style={{ fontSize: '20px', color: 'var(--success-color)' }}>+{collateralToReceive.toFixed(2)} XLM</Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ padding: '16px', background: 'rgba(39, 174, 96, 0.05)', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(39, 174, 96, 0.15)' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', color: 'var(--success-color)' }}>LIQUIDATOR BONUS</Text>
                  <Text strong style={{ fontSize: '20px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Sparkles size={16} /> +{loan.liquidationBonus}%
                  </Text>
                </div>
              </Col>
            </Row>

            <div style={{ marginTop: '20px', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}>
              <div>- <b>USDC Repayment Value:</b> ${repayAmount.toFixed(2)}</div>
              <div>- <b>Collateral Value Received:</b> ${collateralValueToReceive.toFixed(2)} (Earns ${ (collateralValueToReceive - repayAmount).toFixed(2) } arbitrage profit)</div>
              <div>- <b>Remaining Debt:</b> ${remainingDebt.toFixed(2)} USDC</div>
            </div>
          </Card>
        </Col>

        {/* Right Side Status Panel */}
        <Col xs={24} lg={9}>
          {txStatus ? (
            <TransactionReceiptCard
              status={txStatus}
              txHash={matchedTx?.txHash}
              explorerUrl={matchedTx?.explorerUrl}
              ledger={matchedTx?.ledger}
              amount={repayAmount}
              asset="USDC"
              actionName="Liquidation Call"
              errorDetails={errorDetails}
              onClose={() => setTxStatus(null)}
            />
          ) : (
            <Card title="Confirm Execution" styles={{ body: { padding: '24px' } }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <HealthFactorGauge value={estHFAfter} size={130} showMeaning />
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'var(--bg-color)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Wallet Balance:</span>
                  <span style={{ fontWeight: 600 }}>${wallet.balanceUSDC.toLocaleString()} USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Required Repay:</span>
                  <span style={{ fontWeight: 600, color: 'var(--danger-color)' }}>${repayAmount.toFixed(2)} USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Close Factor Limit:</span>
                  <span style={{ fontWeight: 600 }}>${maxRepayAmount.toFixed(2)} USDC</span>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <Text strong style={{ fontSize: '12px' }}>
                    REPAY AMOUNT (USDC)
                  </Text>
                  <Button size="small" type="dashed" onClick={() => setRepayAmount(maxRepayAmount)}>
                    Max Close Factor (50%)
                  </Button>
                </div>
                <InputNumber
                  min={1}
                  max={maxRepayAmount}
                  step={10}
                  value={repayAmount}
                  onChange={(value) => setRepayAmount(value || 0)}
                  style={{ width: '100%' }}
                  size="large"
                />
              </div>

              {!eligible ? (
                <Alert
                  message="Loan Not Eligible"
                  description="Liquidation is only allowed when Health Factor is below 1.2 or the loan is defaulted."
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              ) : !hasValidRepayAmount ? (
                <Alert
                  message="Invalid Repay Amount"
                  description={`Repay amount must be greater than 0 and no more than the 50% close factor (${formatCurrency(maxRepayAmount, 'USDC')}).`}
                  type="error"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              ) : wallet.balanceUSDC < repayAmount ? (
                <Alert
                  message="Insufficient USDC"
                  description={`You need $${repayAmount.toFixed(2)} USDC to execute, but your balance is only $${wallet.balanceUSDC.toLocaleString()} USDC.`}
                  type="error"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              ) : (
                <Alert
                  message="Arbitrage Ready"
                  description={`Your wallet will receive ${collateralToReceive.toFixed(2)} XLM from the loan escrow in exchange for $${repayAmount.toFixed(2)} USDC.`}
                  type="success"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              )}

              <Button
                type="primary"
                danger
                size="large"
                disabled={!canExecute}
                icon={<Flame size={18} style={{ marginRight: 6 }} />}
                onClick={handleConfirmLiquidation}
                style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Confirm Liquidation
              </Button>
            </Card>
          )}
        </Col>
      </Row>

      {/* Execution Confirmation Modal */}
      <ConfirmActionModal
        visible={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        onConfirm={handleExecuteLiquidation}
        title="Confirm Liquidation Call"
        actionText="Execute Liquidation Trigger"
        danger
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p>You are executing a liquidation transaction on the Stellar Soroban network.</p>
          <div style={{
            background: 'var(--bg-color)',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '13px'
          }}>
            <div>- <b>USDC Debt Repayment:</b> ${repayAmount.toFixed(2)} USDC</div>
            <div>- <b>Collateral to Claim:</b> {collateralToReceive.toFixed(2)} XLM</div>
            <div>- <b>Arbitrage Yield Profit:</b> +${ (collateralValueToReceive - repayAmount).toFixed(2) } USDC</div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            * This action is final. Collateral is transferred directly out of the smart contract escrow into your wallet.
          </p>
        </div>
      </ConfirmActionModal>
    </div>
  );
};
