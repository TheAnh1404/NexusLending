import React, { useState } from 'react';
import { Modal, Tabs, Typography, Button, InputNumber, Alert, Tag } from 'antd';
import { ShieldCheck } from 'lucide-react';
import type { Loan } from '../../types';
import { useAppContext } from '../../app/AppContext';
import { useWallet } from '../../hooks/useWallet';
import {
  calculateHealthFactor,
  calculateMaxLiquidationRepay,
  formatAddress,
  formatCurrency,
  getDaysRemaining,
  isLiquidatable,
  isOpenLoanStatus,
} from '../../utils/finance';
import { getConnectedWalletAddress, isSameWalletAddress } from '../../utils/wallet';
import { HealthStatus } from './HealthStatus';
import { getHealthCategory } from '../../utils/health';
import { AdvancedDetails } from './AdvancedDetails';
import { TransactionProgress, type TransactionStepState } from './TransactionProgress';

const { Title, Text } = Typography;

interface ManageLoanDrawerProps {
  open: boolean;
  loan: Loan | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ManageLoanDrawer: React.FC<ManageLoanDrawerProps> = ({ open, loan, onClose, onSuccess }) => {
  const { oraclePrices, wallet, repayLoan, addCollateral, liquidateLoan } = useAppContext();
  const { publicKey } = useWallet();

  const [activeTab, setActiveTab] = useState('overview');
  const [repayAmount, setRepayAmount] = useState<number>(0);
  const [isFullRepay, setIsFullRepay] = useState<boolean>(false);
  const [additionalCollateral, setAdditionalCollateral] = useState<number>(0);
  const [liquidateAmount, setLiquidateAmount] = useState<number>(0);

  const [txState, setTxState] = useState<TransactionStepState>('idle');
  const [rawError, setRawError] = useState<string | undefined>(undefined);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

  if (!loan) return null;

  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);
  const isBorrower = isSameWalletAddress(connectedWalletAddress, loan.borrower);
  const daysRemaining = getDaysRemaining(loan.dueDate);
  const canLiquidate = isOpenLoanStatus(loan.status) && isLiquidatable(loan.healthFactor, loan.status);

  // Health Preview for Add Collateral
  const estimatedCollateralAfterDeposit = loan.collateralAmount + additionalCollateral;
  const estimatedHFAfterDeposit = calculateHealthFactor(
    estimatedCollateralAfterDeposit,
    xlmPrice,
    loan.outstandingDebt,
    usdcPrice,
    loan.liquidationThreshold
  );

  const currentCategory = getHealthCategory(loan.healthFactor, loan.status);
  const estimatedCategory = getHealthCategory(estimatedHFAfterDeposit, loan.status);

  // Max Liquidation calculations
  const maxLiquidationRepay = calculateMaxLiquidationRepay(
    loan.outstandingDebt,
    loan.collateralAmount,
    xlmPrice,
    loan.liquidationBonus
  );

  const handleRepay = async () => {
    const targetRepay = isFullRepay ? loan.outstandingDebt : repayAmount;
    if (targetRepay <= 0) {
      setRawError('Please enter a valid repayment amount.');
      return;
    }
    setTxState('signing');
    setRawError(undefined);
    try {
      const res = await repayLoan(loan.id, targetRepay, isFullRepay);
      if (res) {
        setTxState('success');
        if (onSuccess) onSuccess();
      } else {
        setTxState('failed');
        setRawError('Repayment transaction failed.');
      }
    } catch (err) {
      setTxState('failed');
      setRawError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddCollateral = async () => {
    if (additionalCollateral <= 0) {
      setRawError('Please enter a valid collateral amount to add.');
      return;
    }
    setTxState('signing');
    setRawError(undefined);
    try {
      await addCollateral(loan.id, additionalCollateral);
      setTxState('success');
      if (onSuccess) onSuccess();
    } catch (err) {
      setTxState('failed');
      setRawError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleLiquidate = async () => {
    const targetAmount = liquidateAmount || maxLiquidationRepay;
    if (targetAmount <= 0) return;
    setTxState('signing');
    setRawError(undefined);
    try {
      await liquidateLoan(loan.id, targetAmount);
      setTxState('success');
      if (onSuccess) onSuccess();
    } catch (err) {
      setTxState('failed');
      setRawError(err instanceof Error ? err.message : String(err));
    }
  };

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Status & Health Summary Box */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(241, 245, 249, 0.8) 100%)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 14,
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Health Status</Text>
              <HealthStatus healthFactor={loan.healthFactor} status={loan.status} showExact />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Borrowed Principal</Text>
                <Text strong>{formatCurrency(loan.amount, loan.asset)}</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Outstanding Debt</Text>
                <Text strong style={{ color: 'var(--primary-color, #4f46e5)', fontSize: 15 }}>
                  {formatCurrency(loan.outstandingDebt, loan.asset)}
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Locked Collateral</Text>
                <Text strong>
                  {loan.collateralAmount.toLocaleString()} {loan.collateralAsset} (${(loan.collateralAmount * xlmPrice).toFixed(2)})
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">Due Date</Text>
                <Text strong>{daysRemaining > 0 ? `In ${daysRemaining} days (${loan.dueDate})` : 'Overdue'}</Text>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            {isBorrower && isOpenLoanStatus(loan.status) && (
              <>
                <Button type="primary" size="large" block onClick={() => setActiveTab('repay')} style={{ borderRadius: 10, height: 44, fontWeight: 700 }}>
                  Repay Loan
                </Button>
                <Button size="large" block onClick={() => setActiveTab('collateral')} style={{ borderRadius: 10, height: 44, fontWeight: 600 }}>
                  Add Collateral
                </Button>
              </>
            )}

            {canLiquidate && (
              <Button danger size="large" block onClick={() => setActiveTab('liquidate')} style={{ borderRadius: 10, height: 44, fontWeight: 700 }}>
                Liquidate Position
              </Button>
            )}
          </div>

          {/* Technical Accordion */}
          <AdvancedDetails
            items={[
              { label: 'Contract Loan ID', value: loan.id, copyable: true },
              { label: 'Offer ID', value: loan.offerId, copyable: true },
              { label: 'Borrower', value: formatAddress(loan.borrower), copyable: true, rawTextToCopy: loan.borrower },
              { label: 'Lender', value: formatAddress(loan.lender), copyable: true, rawTextToCopy: loan.lender },
              { label: 'Health Factor', value: loan.healthFactor.toFixed(4) },
              { label: 'Max LTV', value: `${loan.maxLTV}%` },
              { label: 'Liquidation Threshold', value: `${loan.liquidationThreshold}%` },
              { label: 'Oracle Price', value: `$${xlmPrice.toFixed(4)}` },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'repay',
      label: 'Repay Debt',
      disabled: !isBorrower || !isOpenLoanStatus(loan.status),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            message="Repayment Breakdown"
            description={`Total outstanding debt is ${formatCurrency(loan.outstandingDebt, loan.asset)}.`}
            type="info"
            showIcon
          />

          <div>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 600 }}>
              Repayment Type
            </Text>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Button
                type={!isFullRepay ? 'primary' : 'default'}
                onClick={() => {
                  setIsFullRepay(false);
                  setRepayAmount(Math.min(100, loan.outstandingDebt));
                }}
                style={{ flex: 1, borderRadius: 8, height: 40 }}
              >
                Partial Repayment
              </Button>
              <Button
                type={isFullRepay ? 'primary' : 'default'}
                onClick={() => {
                  setIsFullRepay(true);
                  setRepayAmount(loan.outstandingDebt);
                }}
                style={{ flex: 1, borderRadius: 8, height: 40 }}
              >
                Full Repayment (Close)
              </Button>
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
              Enter Amount to Repay ({loan.asset})
            </Text>
            <InputNumber
              style={{ width: '100%', borderRadius: 10, marginTop: 6 }}
              size="large"
              min={0.01}
              max={loan.outstandingDebt}
              value={repayAmount}
              onChange={(val) => {
                const num = val || 0;
                setRepayAmount(num);
                if (Math.abs(num - loan.outstandingDebt) < 0.01) {
                  setIsFullRepay(true);
                } else {
                  setIsFullRepay(false);
                }
              }}
              addonAfter={loan.asset}
            />

            {/* Quick Percentage Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 12, marginRight: 2, fontWeight: 600 }}>
                Quick Presets:
              </Text>
              {[
                { label: '25%', ratio: 0.25 },
                { label: '50%', ratio: 0.50 },
                { label: '75%', ratio: 0.75 },
                { label: '100% Full', ratio: 1.0 },
              ].map((preset) => {
                const calculatedVal = Math.round(loan.outstandingDebt * preset.ratio * 100) / 100;
                const isSelected = Math.abs(repayAmount - calculatedVal) < 0.05;
                return (
                  <Tag
                    key={preset.label}
                    color={isSelected ? 'blue' : 'default'}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 8,
                      fontWeight: isSelected ? 700 : 500,
                      padding: '3px 10px',
                      fontSize: 12,
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => {
                      if (preset.ratio === 1.0) {
                        setIsFullRepay(true);
                      } else {
                        setIsFullRepay(false);
                      }
                      setRepayAmount(calculatedVal);
                    }}
                  >
                    {preset.label} (${calculatedVal.toFixed(2)})
                  </Tag>
                );
              })}
            </div>
          </div>


          <div style={{ backgroundColor: 'var(--bg-subtle, #f8fafc)', padding: 14, borderRadius: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text type="secondary">Amount Repaying:</Text>
              <Text strong>{formatCurrency(repayAmount, loan.asset)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Remaining Debt After:</Text>
              <Text strong style={{ color: 'var(--primary-color)' }}>
                {formatCurrency(Math.max(0, loan.outstandingDebt - repayAmount), loan.asset)}
              </Text>
            </div>
          </div>

          <Button type="primary" size="large" block onClick={handleRepay} style={{ borderRadius: 10, height: 46, fontWeight: 700 }}>
            Confirm Repayment
          </Button>
        </div>
      ),
    },
    {
      key: 'collateral',
      label: 'Add Collateral',
      disabled: !isBorrower || !isOpenLoanStatus(loan.status),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            message="Health Factor Preview"
            description="Depositing additional collateral increases your Health Factor and lowers liquidation risk."
            type="info"
            showIcon
          />

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Additional Collateral Amount ({loan.collateralAsset})
            </Text>
            <InputNumber
              style={{ width: '100%', borderRadius: 10, marginTop: 6 }}
              size="large"
              min={1}
              value={additionalCollateral}
              onChange={(val) => setAdditionalCollateral(val || 0)}
              addonAfter={loan.collateralAsset}
            />
          </div>

          {/* Live Preview Box */}
          <div style={{ backgroundColor: 'var(--bg-subtle)', padding: 14, borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text type="secondary">Current Health:</Text>
              <Tag color={currentCategory.color}>{currentCategory.label} ({loan.healthFactor.toFixed(2)})</Tag>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary">Estimated Health After:</Text>
              <Tag color={estimatedCategory.color}>{estimatedCategory.label} ({estimatedHFAfterDeposit.toFixed(2)})</Tag>
            </div>
          </div>

          <Button type="primary" size="large" block onClick={handleAddCollateral} style={{ borderRadius: 10, height: 46, fontWeight: 700 }}>
            Deposit Collateral
          </Button>
        </div>
      ),
    },
    {
      key: 'liquidate',
      label: 'Liquidate',
      disabled: !canLiquidate,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert
            message="Partial Liquidation Warning"
            description="This loan health factor has dropped below safe limits. You can repay up to 50% of the borrower's debt to claim collateral with bonus."
            type="warning"
            showIcon
          />

          <div style={{ backgroundColor: 'var(--bg-subtle)', padding: 14, borderRadius: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text type="secondary">Maximum Liquidatable Repay:</Text>
              <Text strong>{formatCurrency(maxLiquidationRepay, loan.asset)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Liquidation Bonus:</Text>
              <Text strong style={{ color: 'var(--success-color)' }}>+{loan.liquidationBonus}%</Text>
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Repay Amount</Text>
            <InputNumber
              style={{ width: '100%', borderRadius: 10, marginTop: 6 }}
              size="large"
              min={1}
              max={maxLiquidationRepay}
              value={liquidateAmount || maxLiquidationRepay}
              onChange={(val) => setLiquidateAmount(val || 0)}
              addonAfter={loan.asset}
            />
          </div>

          <Button danger type="primary" size="large" block onClick={handleLiquidate} style={{ borderRadius: 10, height: 46, fontWeight: 700 }}>
            Execute Partial Liquidation
          </Button>
        </div>
      ),
    },
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
            <ShieldCheck size={24} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
              Manage Loan Position
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Loan ID: {formatAddress(loan.id)}
            </Text>
          </div>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Modal>

      <TransactionProgress
        open={txState !== 'idle'}
        state={txState}
        successMessage="Action submitted and confirmed on the Stellar Soroban network."
        rawError={rawError}
        onClose={() => setTxState('idle')}
      />
    </>
  );
};
