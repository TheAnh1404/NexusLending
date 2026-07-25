import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Steps, Button, Typography, Alert, InputNumber, Divider, Tag } from 'antd';
import { ArrowRight, ArrowLeft, CheckCircle2, Wallet, AlertTriangle, Flame, ShieldCheck } from 'lucide-react';
import type { LoanOffer } from '../../types';
import { useAppContext } from '../../app/AppContext';
import { useWallet } from '../../hooks/useWallet';
import {
  calculateRequiredCollateral,
  calculateRepaymentAmount,
  calculateHealthFactor,
  formatCurrency,
  formatAddress,
} from '../../utils/finance';
import { getConnectedWalletAddress, isSameWalletAddress } from '../../utils/wallet';
import { AdvancedDetails } from './AdvancedDetails';
import { TransactionProgress, type TransactionStepState } from './TransactionProgress';

const { Title, Paragraph, Text } = Typography;

interface BorrowWizardDrawerProps {
  open: boolean;
  offer: LoanOffer | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BorrowWizardDrawer: React.FC<BorrowWizardDrawerProps> = ({ open, offer, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const { oraclePrices, wallet, acceptOffer, activateLoan } = useAppContext();
  const { publicKey } = useWallet();

  const [currentStep, setCurrentStep] = useState(0);
  const [collateralAmount, setCollateralAmount] = useState<number>(0);
  const [txState, setTxState] = useState<TransactionStepState>('idle');
  const [rawError, setRawError] = useState<string | undefined>(undefined);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // Minimum required collateral
  const minRequiredXLM = offer
    ? calculateRequiredCollateral(offer.amount, 1.0, xlmPrice, offer.maxLTV)
    : 0;

  useEffect(() => {
    if (offer) {
      setCollateralAmount(Math.ceil(minRequiredXLM));
      setCurrentStep(0);
      setTxState('idle');
      setRawError(undefined);
    }
  }, [offer, minRequiredXLM]);

  if (!offer) return null;

  const totalRepayment = calculateRepaymentAmount(offer.amount, offer.apr, offer.duration);
  const collateralUsdValue = collateralAmount * xlmPrice;
  const userXlmBalance = wallet.balanceXLM || 0;
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);
  const isBalanceInsufficient = userXlmBalance < collateralAmount;

  const minHfThreshold = Math.max(1.4, offer.minHealthFactor || 1.4);
  const estimatedHF = calculateHealthFactor(
    collateralAmount,
    xlmPrice,
    totalRepayment,
    1.0,
    offer.liquidationThreshold
  );
  const isHfCriticalDanger = estimatedHF < 1.20;
  const isHfBelowMinRequired = estimatedHF < minHfThreshold;

  const handleExecuteBorrow = async () => {
    if (isSameWalletAddress(connectedWalletAddress, offer.lender)) {
      setTxState('failed');
      setRawError('You cannot borrow from an offer created by your own wallet address. Please switch to a different borrower wallet.');
      return;
    }
    if (userXlmBalance < collateralAmount) {
      setTxState('failed');
      setRawError(`Insufficient XLM balance for collateral. Required ${collateralAmount.toLocaleString()} XLM, available ${userXlmBalance.toLocaleString()} XLM.`);
      return;
    }
    if (isHfBelowMinRequired) {
      setTxState('failed');
      setRawError(`Collateral amount results in a Health Factor of ${estimatedHF.toFixed(2)}, which is below the minimum required ${minHfThreshold.toFixed(2)}. Please deposit more XLM.`);
      return;
    }
    setTxState('signing');
    setRawError(undefined);
    try {
      // Step 1: Accept Offer & Deposit Collateral
      const createdLoan = await acceptOffer(offer.id, collateralAmount);
      if (!createdLoan) {
        setTxState('failed');
        setRawError('Failed to accept offer on Stellar smart contract.');
        return;
      }

      // Step 2: Activate Loan
      setTxState('submitting');
      const activated = await activateLoan(createdLoan.id);
      if (activated) {
        setTxState('success');
        setCurrentStep(3);
        if (onSuccess) onSuccess();
      } else {
        setTxState('failed');
        setRawError('Loan was accepted but activation step failed.');
      }
    } catch (error) {
      setTxState('failed');
      setRawError(error instanceof Error ? error.message : String(error));
    }
  };

  const steps = [
    { title: 'Terms' },
    { title: 'Collateral' },
    { title: 'Confirm' },
    { title: 'Complete' },
  ];

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        centered
        width={580}
        styles={{
          mask: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
          },
          body: {
            borderRadius: '16px',
            padding: '12px 4px',
          },
        }}
      >
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
            <Wallet size={24} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
              Borrow {formatCurrency(offer.amount, offer.asset)}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Fixed {offer.apr}% APR for {offer.duration} Days
            </Text>
          </div>
        </div>

        <Steps current={currentStep} items={steps} size="small" style={{ marginBottom: 24 }} />

        {/* STEP 1: REVIEW TERMS */}
        {currentStep === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Alert
              message="Borrow Summary"
              description={`You are borrowing ${formatCurrency(offer.amount, offer.asset)} for ${offer.duration} days.`}
              type="info"
              showIcon
            />

            <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Borrow Principal</Text>
                  <Text strong>{formatCurrency(offer.amount, offer.asset)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Fixed Interest Rate</Text>
                  <Text strong>{offer.apr}% APR</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Duration</Text>
                  <Text strong>{offer.duration} Days</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Required Collateral</Text>
                  <Text strong>{Math.ceil(minRequiredXLM).toLocaleString()} XLM</Text>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Total Repayment Amount</Text>
                  <Text strong style={{ color: 'var(--primary-color)', fontSize: 16 }}>
                    {formatCurrency(totalRepayment, offer.asset)}
                  </Text>
                </div>
              </div>
            </div>

            {/* Advanced Technical Details */}
            <AdvancedDetails
              items={[
                { label: 'Offer ID', value: offer.id, copyable: true },
                { label: 'Lender Address', value: formatAddress(offer.lender), copyable: true, rawTextToCopy: offer.lender },
                { label: 'Max LTV', value: `${offer.maxLTV}%` },
                { label: 'Liquidation Threshold', value: `${offer.liquidationThreshold}%` },
                { label: 'Min Health Factor', value: offer.minHealthFactor },
                { label: 'Oracle XLM Price', value: `$${xlmPrice.toFixed(4)}` },
              ]}
            />

            <Button type="primary" size="large" block onClick={() => setCurrentStep(1)} style={{ borderRadius: 10, height: 46, fontWeight: 700 }}>
              <span>Continue to Deposit Collateral</span>
              <ArrowRight size={18} />
            </Button>
          </div>
        )}

        {/* STEP 2: DEPOSIT COLLATERAL */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <Title level={5} style={{ marginTop: 0 }}>
                Set Collateral Deposit
              </Title>
              <Paragraph type="secondary" style={{ fontSize: 13 }}>
                Collateral will be safely locked in a Soroban Escrow Smart Contract.
              </Paragraph>
            </div>

            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: 16, borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text type="secondary">Collateral Amount (XLM)</Text>
                <Text type="secondary">Wallet Balance: {userXlmBalance.toLocaleString()} XLM</Text>
              </div>

              <InputNumber
                style={{ width: '100%', borderRadius: 10 }}
                size="large"
                min={Math.ceil(minRequiredXLM)}
                value={collateralAmount}
                onChange={(val) => setCollateralAmount(val || Math.ceil(minRequiredXLM))}
                addonAfter="XLM"
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                <Text type="secondary">Converted USD Value:</Text>
                <Text strong>${collateralUsdValue.toFixed(2)} USD</Text>
              </div>
            </div>

            {userXlmBalance < collateralAmount && (
              <Alert
                type="warning"
                showIcon
                message="Insufficient XLM Collateral Balance"
                description={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span>You need more test collateral to activate this loan.</span>
                    <Button size="small" type="primary" onClick={() => navigate('/faucet?asset=XLM&returnTo=/app/marketplace')}>
                      Open Faucet
                    </Button>
                  </div>
                }
              />
            )}

            {/* HEALTH FACTOR WARNING SYSTEM */}
            {isHfCriticalDanger ? (
              <Alert
                message="🚨 Critical Liquidation Risk (HF < 1.20)"
                description={`Collateral of ${collateralAmount.toLocaleString()} XLM results in a dangerous Health Factor of ${estimatedHF.toFixed(2)}. Your collateral will be at severe risk of immediate liquidation if market price moves down. Please deposit more XLM.`}
                type="error"
                showIcon
                icon={<Flame size={20} color="#dc2626" />}
              />
            ) : isHfBelowMinRequired ? (
              <Alert
                message={`⚠️ Health Factor Below Minimum (${estimatedHF.toFixed(2)} < ${minHfThreshold.toFixed(2)})`}
                description={`Your collateral deposit results in a Health Factor of ${estimatedHF.toFixed(2)}. Soroban smart contracts require a minimum Health Factor of ${minHfThreshold.toFixed(2)} to activate this loan. Increase your collateral amount.`}
                type="warning"
                showIcon
                icon={<AlertTriangle size={20} color="#d97706" />}
              />
            ) : (
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  padding: '12px 16px',
                  borderRadius: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={20} color="#10b981" />
                  <div>
                    <Text strong style={{ fontSize: 13, color: '#047857' }}>
                      Safe Collateral Health Factor
                    </Text>
                    <div style={{ fontSize: 12, color: '#065f46' }}>
                      Required Minimum: {minHfThreshold.toFixed(2)} | Current: {estimatedHF.toFixed(2)}
                    </div>
                  </div>
                </div>
                <Tag color="green" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                  HF {estimatedHF.toFixed(2)}
                </Tag>
              </div>
            )}

            {isBalanceInsufficient && (
              <Alert
                message="Insufficient XLM Balance"
                description={`You need ${collateralAmount.toLocaleString()} XLM, but your wallet only has ${userXlmBalance.toLocaleString()} XLM.`}
                type="error"
                showIcon
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
                disabled={isBalanceInsufficient || isHfBelowMinRequired}
                onClick={() => setCurrentStep(2)}
                style={{ borderRadius: 10, height: 46, fontWeight: 700 }}
              >
                <span>Review & Confirm</span>
                <ArrowRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: CONFIRM & SIGN */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Alert
              message="Final Confirmation"
              description="Please review your borrow request carefully before signing with Freighter Wallet."
              type="warning"
              showIcon
            />

            <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">You Borrow</Text>
                  <Text strong style={{ fontSize: 16, color: 'var(--success-color)' }}>
                    {formatCurrency(offer.amount, offer.asset)}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">You Lock in Escrow</Text>
                  <Text strong style={{ fontSize: 16 }}>
                    {collateralAmount.toLocaleString()} XLM
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">You Repay Total</Text>
                  <Text strong style={{ fontSize: 16, color: 'var(--primary-color)' }}>
                    {formatCurrency(totalRepayment, offer.asset)}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Duration</Text>
                  <Text strong>{offer.duration} Days</Text>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Button size="large" onClick={() => setCurrentStep(1)} style={{ borderRadius: 10, height: 46 }}>
                <ArrowLeft size={16} />
                <span>Back</span>
              </Button>
              <Button
                type="primary"
                size="large"
                block
                onClick={handleExecuteBorrow}
                style={{ borderRadius: 10, height: 46, fontWeight: 700 }}
              >
                Confirm and Sign
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: COMPLETED */}
        {currentStep === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CheckCircle2 size={56} style={{ color: 'var(--success-color)', margin: '0 auto' }} />
            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
              Loan Activated Successfully!
            </Title>
            <Paragraph type="secondary" style={{ fontSize: 14 }}>
              Your collateral of {collateralAmount.toLocaleString()} XLM has been deposited, and {formatCurrency(offer.amount, offer.asset)} is active in your wallet.
            </Paragraph>
            <Button
              type="primary"
              size="large"
              onClick={onClose}
              style={{ borderRadius: 10, height: 46, fontWeight: 700 }}
            >
              Done
            </Button>
          </div>
        )}
      </Modal>

      {/* Shared Transaction Progress Modal */}
      <TransactionProgress
        open={txState !== 'idle' && currentStep !== 3}
        state={txState}
        successMessage="Your loan has been activated on the Stellar Soroban network."
        rawError={rawError}
        onClose={() => setTxState('idle')}
      />
    </>
  );
};
