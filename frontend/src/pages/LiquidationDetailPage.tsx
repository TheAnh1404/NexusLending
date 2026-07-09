import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateHealthFactor, calculateMaxLiquidationRepay, formatCurrency, isLiquidatable } from '../utils/finance';
import { HealthFactorGauge } from '../components/common/HealthFactorGauge';
import { EmptyState } from '../components/common/CommonStates';
import { ConfirmActionModal } from '../components/common/ConfirmActionModal';
import { TransactionReceiptCard } from '../components/common/TransactionReceiptCard';
import { motion } from 'framer-motion';
import {
  Card,
  Row,
  Col,
  Descriptions,
  Button,
  Typography,
  Alert,
  InputNumber,
  Modal,
  Divider,
  Space,
  message,
} from 'antd';
import { 
  Flame, 
  ArrowLeft, 
  Sparkles, 
  ExternalLink, 
  Wallet, 
  Coins, 
  Copy, 
  Check, 
  Info,
  TrendingDown
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const LiquidationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loans, oraclePrices, wallet, liquidateLoan, transactions } = useAppContext();

  const loan = loans.find((l) => l.id === id);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [repayAmount, setRepayAmount] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const maxRepayAmount = loan
    ? calculateMaxLiquidationRepay(loan.outstandingDebt, loan.collateralAmount, xlmPrice, loan.liquidationBonus)
    : 0;

  // Stepper transaction status
  const [txStatus, setTxStatus] = useState<'preparing' | 'signing' | 'submitting' | 'confirming' | 'confirmed' | 'failed' | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>('');

  useEffect(() => {
    if (loan) {
      setRepayAmount(maxRepayAmount);
    }
  }, [loan, maxRepayAmount]);

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

  // Copy handler
  const handleCopyText = (text: string, idStr: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idStr);
    setTimeout(() => setCopiedId(null), 1500);
    message.success('Copied to clipboard');
  };

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
      setSuccessModalVisible(true);
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
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '40px' }}
    >
      
      {/* 1. Navigation & Header */}
      <div>
        <Button
          type="text"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate('/app/liquidation')}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: 0, color: 'var(--text-muted)', marginBottom: '8px' }}
        >
          Back to Liquidation Center
        </Button>
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '26px' }}>
          Plan Partial Liquidation
        </Title>
        <Paragraph type="secondary" style={{ margin: 0, color: 'var(--text-muted)' }}>
          Review liquidation parameters, adjust debt repayment in USDC, and seize collateralized XLM with an arbitrage bonus.
        </Paragraph>
      </div>

      {/* 2. Grid Console */}
      <Row gutter={[24, 24]}>
        
        {/* Left Side: Summary and Math */}
        <Col xs={24} lg={15}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Contract details card */}
            <Card 
              title={
                <Space size={8}>
                  <Info size={16} style={{ color: 'var(--primary-color)' }} />
                  <span style={{ fontSize: '15px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Contract Profile</span>
                </Space>
              }
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}
            >
              <Descriptions
                bordered
                column={1}
                size="small"
                styles={{ label: { width: '200px', fontWeight: 600, background: 'var(--bg-color)' } }}
                items={[
                  {
                    key: 'contractId',
                    label: 'Contract ID',
                    children: (
                      <Space size={4}>
                        <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{loan.id}</Text>
                        <Button
                          type="text"
                          size="small"
                          icon={copiedId === loan.id ? <Check size={12} style={{ color: 'var(--success-color)' }} /> : <Copy size={12} />}
                          onClick={() => handleCopyText(loan.id, loan.id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                      </Space>
                    ),
                  },
                  {
                    key: 'borrower',
                    label: 'Borrower Wallet',
                    children: (
                      <Space size={4}>
                        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{loan.borrower}</Text>
                        <Button
                          type="text"
                          size="small"
                          icon={copiedId === loan.borrower ? <Check size={12} style={{ color: 'var(--success-color)' }} /> : <Copy size={12} />}
                          onClick={() => handleCopyText(loan.borrower, loan.borrower)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                      </Space>
                    ),
                  },
                  {
                    key: 'lender',
                    label: 'Lender Wallet',
                    children: (
                      <Space size={4}>
                        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{loan.lender}</Text>
                        <Button
                          type="text"
                          size="small"
                          icon={copiedId === loan.lender ? <Check size={12} style={{ color: 'var(--success-color)' }} /> : <Copy size={12} />}
                          onClick={() => handleCopyText(loan.lender, loan.lender)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        />
                      </Space>
                    ),
                  },
                  {
                    key: 'outstandingDebt',
                    label: 'Total Outstanding Debt',
                    children: <Text strong style={{ color: 'var(--danger-color)' }}>{formatCurrency(loan.outstandingDebt, 'USDC')}</Text>,
                  },
                  {
                    key: 'collateral',
                    label: 'Locked Escrow Collateral',
                    children: <Text strong>{loan.collateralAmount.toLocaleString()} XLM (${(loan.collateralAmount * xlmPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</Text>,
                  },
                ]}
              />
            </Card>

            {/* Liquidation math card */}
            <Card 
              title={
                <Space size={8}>
                  <Coins size={16} style={{ color: 'var(--success-color)' }} />
                  <span style={{ fontSize: '15px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Execution Parameters & Net Arbitrage</span>
                </Space>
              }
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.12)', borderRadius: '8px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>USDC Debt Repayment</Text>
                    <Text strong style={{ fontSize: '20px', color: 'var(--danger-color)', fontFamily: 'var(--font-mono)' }}>-${repayAmount.toFixed(2)}</Text>
                  </div>
                </Col>
                <Col xs={24} sm={8}>
                  <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.12)', borderRadius: '8px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Collateral Seized</Text>
                    <Text strong style={{ fontSize: '20px', color: 'var(--success-color)', fontFamily: 'var(--font-mono)' }}>+{collateralToReceive.toFixed(2)} XLM</Text>
                  </div>
                </Col>
                <Col xs={24} sm={8}>
                  <div style={{ padding: '16px', background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '8px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 600, color: 'var(--secondary-color)' }}>Est. Arbitrage Profit</Text>
                    <Text strong style={{ fontSize: '20px', color: 'var(--secondary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                      <Sparkles size={16} /> +${(collateralValueToReceive - repayAmount).toFixed(2)}
                    </Text>
                  </div>
                </Col>
              </Row>

              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">USDC Repayment Amount:</Text>
                  <Text strong>${repayAmount.toFixed(2)} USDC</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Collateral Value Received (with {loan.liquidationBonus}% Bonus):</Text>
                  <Text strong style={{ color: 'var(--success-color)' }}>${collateralValueToReceive.toFixed(2)} USD</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Remaining Contract Outstanding Debt:</Text>
                  <Text strong style={{ fontFamily: 'var(--font-mono)' }}>${remainingDebt.toFixed(2)} USDC</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Remaining Locked Escrow Collateral:</Text>
                  <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{remainingCollateral.toFixed(2)} XLM</Text>
                </div>
              </div>
            </Card>

          </div>
        </Col>

        {/* Right Side: Status and Confirmation Input */}
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
            <Card 
              title={
                <Space size={8}>
                  <TrendingDown size={16} style={{ color: 'var(--primary-color)' }} />
                  <span style={{ fontSize: '15px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Execution Console</span>
                </Space>
              }
              style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <HealthFactorGauge value={estHFAfter} size={140} showMeaning />
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
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Wallet size={14} /> Wallet USDC Balance:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(wallet.balanceUSDC, 'USDC')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Repay Value:</span>
                  <span style={{ fontWeight: 600, color: 'var(--danger-color)' }}>-${repayAmount.toFixed(2)} USDC</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Max Protocol Repay:</span>
                    <span style={{ fontWeight: 600 }}>${maxRepayAmount.toFixed(2)} USDC</span>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <Text strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Repay Amount
                  </Text>
                  <Button size="small" type="dashed" onClick={() => setRepayAmount(maxRepayAmount)} style={{ fontSize: '11px' }}>
                    Max Safe Repay
                  </Button>
                </div>
                <InputNumber
                  min={1}
                  max={maxRepayAmount}
                  step={10}
                  value={repayAmount}
                  onChange={(value) => setRepayAmount(value || 0)}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value!.replace(/\$\s?|(,*)/g, ''))}
                  style={{ width: '100%', borderRadius: 'var(--radius-sm)' }}
                  size="large"
                />
              </div>

              {/* Validator Alert Banner */}
              {!eligible ? (
                <Alert
                  message="Position Not Eligible"
                  description="Liquidation is only allowed when Health Factor is below 1.2 or after a loan is Defaulted by the 7-day grace rule."
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px', borderRadius: 'var(--radius-sm)' }}
                />
              ) : !hasValidRepayAmount ? (
                <Alert
                  message="Invalid Amount Entered"
                  description={`Repay amount must be positive and within the safe liquidation limit (${formatCurrency(maxRepayAmount, 'USDC')}).`}
                  type="error"
                  showIcon
                  style={{ marginBottom: '16px', borderRadius: 'var(--radius-sm)' }}
                />
              ) : wallet.balanceUSDC < repayAmount ? (
                <Alert
                  message="Insufficient Liquidity Balance"
                  description={`Your wallet holds ${formatCurrency(wallet.balanceUSDC, 'USDC')}. You need ${formatCurrency(repayAmount, 'USDC')} to proceed.`}
                  type="error"
                  showIcon
                  style={{ marginBottom: '16px', borderRadius: 'var(--radius-sm)' }}
                />
              ) : (
                <Alert
                  message="Arbitrage Match Ready"
                  description={`Receive ~${collateralToReceive.toFixed(2)} XLM from escrow in exchange for ${formatCurrency(repayAmount, 'USDC')}.`}
                  type="success"
                  showIcon
                  style={{ marginBottom: '16px', borderRadius: 'var(--radius-sm)' }}
                />
              )}

              <Button
                type="primary"
                danger
                size="large"
                disabled={!canExecute}
                icon={<Flame size={16} />}
                onClick={handleConfirmLiquidation}
                style={{ 
                  width: '100%', 
                  height: '46px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px', 
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '15px'
                }}
              >
                Confirm Liquidation Call
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
          <p>You are executing an isolated contract liquidation transaction on the Stellar Soroban network.</p>
          <div style={{
            background: 'var(--bg-color)',
            padding: '16px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div>- <b>USDC Debt Repayment:</b> {formatCurrency(repayAmount, 'USDC')}</div>
            <div>- <b>Collateral to Claim:</b> {collateralToReceive.toFixed(2)} XLM</div>
            <div>- <b>Arbitrage Yield Profit:</b> +${ (collateralValueToReceive - repayAmount).toFixed(2) } USDC</div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            * This action is finalized immediately on-chain. Reward collateral is claimed directly out of the smart contract escrow into your wallet.
          </p>
        </div>
      </ConfirmActionModal>

      {/* Success Receipt Modal */}
      <Modal
        open={successModalVisible}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success-color)' }}>
            <Sparkles size={20} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>Liquidation Success Receipt</span>
          </div>
        }
        footer={[
          <Button key="close" type="primary" onClick={() => { setSuccessModalVisible(false); navigate('/app/liquidation'); }} style={{ borderRadius: '6px' }}>
            Dismiss Receipt
          </Button>
        ]}
        onCancel={() => setSuccessModalVisible(false)}
        width={480}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <Alert
            type="success"
            showIcon
            message={<span style={{ fontWeight: 700 }}>On-Chain Liquidation Settled</span>}
            description="The Soroban contract executed the partial liquidation. Stressed debt is cleared and reward collateral is credited."
          />

          <div style={{
            padding: '16px',
            backgroundColor: 'var(--border-light)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Contract Loan ID:</Text>
              <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{loan.id}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">USDC Repaid by Liquidator:</Text>
              <Text strong style={{ color: 'var(--danger-color)' }}>{formatCurrency(repayAmount, 'USDC')}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">XLM Seized (with {loan.liquidationBonus}% Bonus):</Text>
              <Text strong style={{ color: 'var(--success-color)' }}>+{collateralToReceive.toFixed(2)} XLM</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Collateral USD Value:</Text>
              <Text strong>${collateralValueToReceive.toFixed(2)} USD</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Estimated Net Arbitrage:</Text>
              <Text strong style={{ color: 'var(--success-color)' }}>+${(collateralValueToReceive - repayAmount).toFixed(2)} USDC</Text>
            </div>
            
            {matchedTx && (
              <>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text type="secondary">Transaction Hash:</Text>
                  <div style={{ textAlign: 'right' }}>
                    <a href={matchedTx.explorerUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)' }}>
                      {matchedTx.txHash?.slice(0, 8)}...{matchedTx.txHash?.slice(-8)} <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
                {matchedTx.ledger && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Ledger Height:</Text>
                    <Text style={{ fontFamily: 'var(--font-mono)' }}>#{matchedTx.ledger}</Text>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};
