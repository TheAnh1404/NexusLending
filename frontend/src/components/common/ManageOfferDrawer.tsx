import React, { useState } from 'react';
import { Modal, Button, Typography, Alert, Tag, Popconfirm } from 'antd';
import { Trash2, ShieldCheck, Lock } from 'lucide-react';
import type { LoanOffer } from '../../types';
import { useAppContext } from '../../app/AppContext';
import { calculateRequiredCollateral, formatAddress } from '../../utils/finance';
import { OfferIdBadge } from './OfferIdBadge';
import { TransactionProgress, type TransactionStepState } from './TransactionProgress';

const { Title, Text } = Typography;

interface ManageOfferDrawerProps {
  open: boolean;
  offer: LoanOffer | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ManageOfferDrawer: React.FC<ManageOfferDrawerProps> = ({ open, offer, onClose, onSuccess }) => {
  const { oraclePrices, cancelOffer, fundOffer, activateOffer, wallet } = useAppContext();

  const [txState, setTxState] = useState<TransactionStepState>('idle');
  const [rawError, setRawError] = useState<string | undefined>(undefined);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  if (!offer) return null;

  const requiredCollateral = calculateRequiredCollateral(offer.amount, 1.0, xlmPrice, offer.maxLTV);
  const collateralValueUsd = Math.ceil(requiredCollateral) * xlmPrice;
  const interestReturn = (offer.amount * (offer.apr / 100) * offer.duration) / 365;

  const handleFundAndActivateDraft = async () => {
    const userUsdc = wallet.balanceUSDC || 0;
    const userXlm = wallet.balanceXLM || 0;

    if (userUsdc < offer.amount) {
      setTxState('failed');
      setRawError(`Insufficient USDC balance to fund offer escrow (${userUsdc.toLocaleString()} USDC available, ${offer.amount.toLocaleString()} USDC required). Please top up via Faucet.`);
      return;
    }
    if (userXlm < 2.0) {
      setTxState('failed');
      setRawError(`Insufficient XLM balance for Stellar gas fees (${userXlm.toLocaleString()} XLM available, minimum 2.0 XLM required). Please top up via Faucet.`);
      return;
    }

    setTxState('preparing');
    setRawError(undefined);

    try {
      setTxState('simulating');
      const funded = await fundOffer(offer.id);
      if (!funded) {
        setTxState('failed');
        setRawError('Failed to fund offer escrow with USDC.');
        return;
      }

      setTxState('submitting');
      const activated = await activateOffer(offer.id);
      if (activated) {
        setTxState('success');
        setTimeout(() => {
          onSuccess?.();
          onClose();
          setTxState('idle');
        }, 1500);
      } else {
        setTxState('failed');
        setRawError('Offer funded successfully, but marketplace activation failed.');
      }
    } catch (error) {
      setTxState('failed');
      setRawError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCancelOffer = async () => {
    setTxState('preparing');
    setRawError(undefined);

    try {
      setTxState('signing');
      await cancelOffer(offer.id);
      setTxState('success');
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setTxState('idle');
      }, 1500);
    } catch (error) {
      setTxState('failed');
      setRawError(error instanceof Error ? error.message : 'Failed to cancel offer on-chain.');
    }
  };

  const handleReset = () => {
    setTxState('idle');
    setRawError(undefined);
  };

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (txState !== 'preparing' && txState !== 'signing') {
          handleReset();
          onClose();
        }
      }}
      footer={null}
      width={560}
      destroyOnClose
      centered
      styles={{ body: { padding: '24px' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={20} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                Manage Your Listed Offer
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                You are the Lender of this active offer
              </Text>
            </div>
          </div>

          <OfferIdBadge id={offer.id} size="medium" />
        </div>

        {/* Transaction Progress Overlay */}
        <TransactionProgress
          open={txState !== 'idle'}
          state={txState}
          title="Cancelling Offer & Unlocking Liquidity"
          rawError={rawError}
          onClose={handleReset}
        />

        {txState === 'idle' && (
          <>
            {/* Status Alert */}
            {offer.status === 'Draft' ? (
              <Alert
                type="warning"
                showIcon
                icon={<ShieldCheck size={18} style={{ color: '#d97706' }} />}
                message={<Text strong style={{ color: '#92400e' }}>Offer Currently in Draft Status</Text>}
                description={
                  <Text style={{ fontSize: 12, color: '#78350f' }}>
                    This offer is saved as a draft and HAS NOT been funded with USDC escrow on-chain. Click "Fund & Activate Offer" below to complete funding and list it on the marketplace.
                  </Text>
                }
                style={{ borderRadius: 12, backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
              />
            ) : (
              <Alert
                type="info"
                showIcon
                icon={<ShieldCheck size={18} style={{ color: '#2563eb' }} />}
                message={<Text strong style={{ color: '#1e40af' }}>Active Liquidity Deposited</Text>}
                description={
                  <Text style={{ fontSize: 12, color: '#1e3a8a' }}>
                    Your {offer.amount.toLocaleString()} {offer.asset} is safely deposited in the Soroban Marketplace Smart Contract escrow. Any borrower matching your terms can accept this offer.
                  </Text>
                }
                style={{ borderRadius: 12, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}
              />
            )}

            {/* Financial Overview Card */}
            <div style={{ backgroundColor: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Offer Parameters
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Principal Liquidity:</Text>
                  <Text strong style={{ fontSize: 16, color: 'var(--text-main)', fontWeight: 800 }}>
                    {offer.amount.toLocaleString()} {offer.asset}
                  </Text>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Fixed Interest APR:</Text>
                  <Tag color="purple" style={{ width: 'fit-content', fontWeight: 800, fontSize: 13, padding: '2px 8px', borderRadius: 6 }}>
                    {offer.apr}% APR
                  </Tag>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Loan Duration:</Text>
                  <Text strong style={{ fontSize: 13 }}>{offer.duration} Days</Text>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Expected Yield:</Text>
                  <Text strong style={{ fontSize: 13, color: '#10b981' }}>
                    +{interestReturn.toFixed(2)} {offer.asset}
                  </Text>
                </div>
              </div>

              <div style={{ height: 1, backgroundColor: '#e2e8f0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Required XLM Collateral per Borrower:</Text>
                <Text strong style={{ fontSize: 13 }}>
                  {Math.ceil(requiredCollateral).toLocaleString()} XLM (~${collateralValueUsd.toFixed(2)})
                </Text>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Max LTV / Liquidation Threshold:</Text>
                <Text strong style={{ fontSize: 13, color: '#2563eb' }}>
                  {offer.maxLTV}% LTV / {offer.liquidationThreshold}% Thresh
                </Text>
              </div>
            </div>

            {/* Smart Contract Info */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: 8 }}>
              <span>Lender Wallet: <Text code style={{ fontSize: 11 }}>{formatAddress(offer.lender)}</Text></span>
              <Tag color={offer.status === 'Draft' ? 'orange' : 'green'} style={{ borderRadius: 4, fontWeight: 700, margin: 0 }}>
                {offer.status === 'Draft' ? 'SOROBAN DRAFT' : 'SOROBAN ACTIVE'}
              </Tag>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                style={{ borderRadius: 8, height: 40, fontWeight: 600 }}
              >
                Close
              </Button>

              {offer.status === 'Draft' ? (
                <Button
                  type="primary"
                  onClick={handleFundAndActivateDraft}
                  style={{ borderRadius: 8, height: 40, fontWeight: 700, padding: '0 20px', backgroundColor: '#2563eb' }}
                >
                  Fund & Activate Offer
                </Button>
              ) : (
                <Popconfirm
                  title="Cancel Offer & Withdraw Funds?"
                  description={`This will cancel ${offer.id} on Soroban and return your ${offer.amount.toLocaleString()} ${offer.asset} liquidity back to your connected wallet.`}
                  onConfirm={handleCancelOffer}
                  okText="Yes, Cancel Offer"
                  cancelText="No, Keep Active"
                  okButtonProps={{ danger: true, style: { fontWeight: 700 } }}
                >
                  <Button
                    type="primary"
                    danger
                    icon={<Trash2 size={16} />}
                    style={{ borderRadius: 8, height: 40, fontWeight: 700, padding: '0 20px' }}
                  >
                    Cancel & Withdraw Offer
                  </Button>
                </Popconfirm>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
