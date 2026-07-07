import React, { useEffect, useState } from 'react';
import { Alert, Button, Form, InputNumber, Space, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { Loan, WalletState } from '../../types';
import { calculateHealthFactor } from '../../utils/finance';
import { ConfirmActionModal } from './ConfirmActionModal';
import { RiskBadge } from './RiskBadge';

const { Text } = Typography;

interface PartialRepaymentModalProps {
  open: boolean;
  loan?: Loan;
  wallet: WalletState;
  form: FormInstance;
  xlmPrice: number;
  usdcPrice: number;
  onCancel: () => void;
  onConfirm: (amount: number, isFullRepay: boolean) => void | Promise<void>;
}

export const PartialRepaymentModal: React.FC<PartialRepaymentModalProps> = ({
  open,
  loan,
  wallet,
  form,
  xlmPrice,
  usdcPrice,
  onCancel,
  onConfirm,
}) => {
  const [amount, setAmount] = useState(0);
  const [isFullRepay, setIsFullRepay] = useState(true);

  useEffect(() => {
    if (open && loan) {
      const fullAmount = Math.round(loan.outstandingDebt * 100) / 100;
      setAmount(fullAmount);
      setIsFullRepay(true);
      form.setFieldsValue({ amount: fullAmount });
    }
    if (!open) {
      setAmount(0);
      setIsFullRepay(true);
      form.resetFields();
    }
  }, [form, loan, open]);

  const nextHealthFactor = loan
    ? calculateHealthFactor(
        loan.collateralAmount,
        xlmPrice,
        Math.max(0, loan.outstandingDebt - amount),
        usdcPrice,
        loan.liquidationThreshold
      )
    : 0;

  return (
    <ConfirmActionModal
      visible={open}
      onCancel={onCancel}
      onConfirm={() => onConfirm(amount, isFullRepay)}
      title="Repay Outstanding Debt"
      actionText="Process USDC Repayment"
    >
      {loan && (
        <Form form={form} layout="vertical">
          <div className="metric-panel" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <Text>Wallet USDC Balance:</Text>
            <Text strong>${wallet.balanceUSDC.toLocaleString()}</Text>
          </div>

          <Space orientation="horizontal" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap' }}>
            <Button
              type={isFullRepay ? 'primary' : 'default'}
              onClick={() => {
                const fullAmount = Math.round(loan.outstandingDebt * 100) / 100;
                setIsFullRepay(true);
                setAmount(fullAmount);
                form.setFieldsValue({ amount: fullAmount });
              }}
            >
              Full Repayment (${loan.outstandingDebt.toFixed(2)})
            </Button>
            <Button
              type={!isFullRepay ? 'primary' : 'default'}
              onClick={() => {
                const partialAmount = Math.round(loan.outstandingDebt * 0.25);
                setIsFullRepay(false);
                setAmount(partialAmount);
                form.setFieldsValue({ amount: partialAmount });
              }}
            >
              Partial Repayment
            </Button>
          </Space>

          <Form.Item
            label="USDC Amount to Repay"
            name="amount"
            rules={[
              { required: true, message: 'Please enter repayment amount' },
              {
                validator: (_, value) => {
                  if (!value || value <= wallet.balanceUSDC) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Insufficient USDC balance'));
                },
              },
              {
                validator: (_, value) => {
                  if (!value || value <= loan.outstandingDebt + 0.01) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Repayment exceeds outstanding debt'));
                },
              },
            ]}
          >
            <InputNumber
              min={1}
              max={loan.outstandingDebt}
              disabled={isFullRepay}
              style={{ width: '100%' }}
              size="large"
              onChange={(val) => setAmount(val || 0)}
            />
          </Form.Item>

          {isFullRepay ? (
            <Alert
              title="Collateral Reclaimed"
              description={`Full repayment releases ${loan.collateralAmount.toLocaleString()} XLM back to the borrower wallet.`}
              type="info"
              showIcon
            />
          ) : (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--bg-color)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                  ESTIMATED HF AFTER PARTIAL REPAY
                </span>
                <div style={{ marginTop: '4px' }}>
                  <Text delete style={{ fontSize: '13px' }}>{loan.healthFactor.toFixed(2)}</Text>
                  <Text strong style={{ fontSize: '16px', color: 'var(--success-color)', marginLeft: '8px' }}>
                    -&gt; {nextHealthFactor.toFixed(2)}
                  </Text>
                </div>
              </div>
              <RiskBadge healthFactor={nextHealthFactor} />
            </div>
          )}
        </Form>
      )}
    </ConfirmActionModal>
  );
};
