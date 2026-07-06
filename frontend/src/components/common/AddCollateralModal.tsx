import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { Loan, WalletState } from '../../types';
import { calculateHealthFactor } from '../../utils/finance';
import { ConfirmActionModal } from './ConfirmActionModal';
import { RiskBadge } from './RiskBadge';

const { Text } = Typography;

interface AddCollateralModalProps {
  open: boolean;
  loan?: Loan;
  wallet: WalletState;
  form: FormInstance;
  xlmPrice: number;
  usdcPrice: number;
  onCancel: () => void;
  onConfirm: (amount: number) => void | Promise<void>;
}

export const AddCollateralModal: React.FC<AddCollateralModalProps> = ({
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

  useEffect(() => {
    if (!open) {
      setAmount(0);
      form.resetFields();
    }
  }, [form, open]);

  const nextHealthFactor = loan
    ? calculateHealthFactor(
        loan.collateralAmount + amount,
        xlmPrice,
        loan.outstandingDebt,
        usdcPrice,
        loan.liquidationThreshold
      )
    : 0;

  return (
    <ConfirmActionModal
      visible={open}
      onCancel={onCancel}
      onConfirm={() => onConfirm(amount)}
      title="Deposit Additional Collateral"
      actionText="Confirm Escrow Deposit"
    >
      {loan && (
        <Form form={form} layout="vertical">
          <div className="metric-panel" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <Text>Wallet Balance:</Text>
            <Text strong>{wallet.balanceXLM.toLocaleString()} XLM</Text>
          </div>
          <Form.Item
            label="Additional XLM to Deposit"
            name="amount"
            rules={[
              { required: true, message: 'Please enter deposit amount' },
              {
                validator: (_, value) => {
                  if (!value || value <= wallet.balanceXLM) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Insufficient XLM balance'));
                },
              },
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} size="large" onChange={(val) => setAmount(val || 0)} />
          </Form.Item>

          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              backgroundColor: 'rgba(39, 174, 96, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(39, 174, 96, 0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                ESTIMATED HF IMPROVEMENT
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
        </Form>
      )}
    </ConfirmActionModal>
  );
};
