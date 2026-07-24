import React, { useState } from 'react';
import { Modal, Spin, Button, Typography, Space, Steps } from 'antd';
import { CheckCircle2, XCircle, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { EXPLORER_NETWORK } from '../../services/soroban/config';

const { Title, Paragraph, Text } = Typography;

export type TransactionStepState =
  | 'idle'
  | 'preparing'
  | 'signing'
  | 'simulating'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'failed'
  | 'rejected';

interface TransactionProgressProps {
  open: boolean;
  state: TransactionStepState;
  title?: string;
  successMessage?: string;
  txHash?: string;
  rawError?: string;
  onClose: () => void;
  onViewLoan?: () => void;
}

const getFriendlyErrorMessage = (errorText?: string): string => {
  if (!errorText) return 'Transaction could not be completed.';
  if (errorText.toLowerCase().includes('user rejected') || errorText.toLowerCase().includes('declined')) {
    return 'Transaction request was cancelled in your wallet.';
  }
  if (errorText.toLowerCase().includes('insufficient') || errorText.toLowerCase().includes('balance')) {
    return 'Your wallet balance is insufficient to complete this transaction.';
  }
  if (errorText.toLowerCase().includes('expired') || errorText.toLowerCase().includes('unavailable')) {
    return 'The offer or loan state is no longer available on the blockchain.';
  }
  return 'Transaction could not be completed. The offer may no longer be available, your balance may be insufficient, or the blockchain rejected the request.';
};

export const TransactionProgress: React.FC<TransactionProgressProps> = ({
  open,
  state,
  successMessage = 'Action completed successfully on the Stellar blockchain.',
  txHash,
  rawError,
  onClose,
  onViewLoan,
}) => {
  const [showTechnical, setShowTechnical] = useState(false);

  const isExecuting =
    state === 'preparing' ||
    state === 'signing' ||
    state === 'simulating' ||
    state === 'submitting' ||
    state === 'confirming';

  const isSuccess = state === 'success';
  const isFailed = state === 'failed' || state === 'rejected';

  const stepItems = [
    { title: 'Prepare' },
    { title: 'Confirm in Wallet' },
    { title: 'Blockchain Confirmation' },
  ];

  const getCurrentStepIndex = () => {
    switch (state) {
      case 'preparing':
        return 0;
      case 'signing':
        return 1;
      case 'simulating':
      case 'submitting':
      case 'confirming':
        return 2;
      case 'success':
        return 3;
      default:
        return 0;
    }
  };

  return (
    <Modal
      open={open}
      footer={null}
      closable={!isExecuting}
      onCancel={isExecuting ? undefined : onClose}
      centered
      width={440}
    >
      <div style={{ padding: '16px 8px', textAlign: 'center' }}>
        {isExecuting && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Spin indicator={<Loader2 size={44} className="pulse-animation" style={{ color: 'var(--primary-color, #4f46e5)' }} />} />
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
                {state === 'signing'
                  ? 'Confirming in Wallet...'
                  : state === 'confirming' || state === 'submitting'
                  ? 'Waiting for Blockchain Confirmation...'
                  : 'Preparing Transaction...'}
              </Title>
              <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0, fontSize: '13px' }}>
                {state === 'signing'
                  ? 'Please check your Freighter Wallet extension to review and sign.'
                  : 'Submitting transaction to Stellar Soroban node...'}
              </Paragraph>
            </div>
            <Steps
              current={getCurrentStepIndex()}
              size="small"
              items={stepItems}
              style={{ marginTop: 12, width: '100%' }}
            />
          </div>
        )}

        {isSuccess && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success-color, #10b981)',
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
                Transaction Complete!
              </Title>
              <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0, fontSize: '13px' }}>
                {successMessage}
              </Paragraph>
            </div>

            {txHash && (
              <div
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-subtle, #f9fafb)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                }}
              >
                <Text type="secondary">Tx Hash:</Text>
                <a
                  href={`https://stellar.expert/explorer/${EXPLORER_NETWORK}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary-color, #4f46e5)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
                >
                  {txHash.slice(0, 8)}...{txHash.slice(-8)}
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            <Space style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
              {onViewLoan && (
                <Button type="primary" onClick={onViewLoan}>
                  View Details
                </Button>
              )}
              <Button onClick={onClose}>Done</Button>
            </Space>
          </div>
        )}

        {isFailed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--danger-color, #ef4444)',
              }}
            >
              <XCircle size={36} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
                Transaction Failed
              </Title>
              <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0, fontSize: '13px' }}>
                {getFriendlyErrorMessage(rawError)}
              </Paragraph>
            </div>

            {rawError && (
              <div style={{ width: '100%', textAlign: 'left' }}>
                <Button
                  type="text"
                  size="small"
                  onClick={() => setShowTechnical(!showTechnical)}
                  style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)', padding: 0 }}
                >
                  <Space size={4}>
                    <span>View Technical Details</span>
                    {showTechnical ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </Space>
                </Button>

                {showTechnical && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      backgroundColor: '#1e293b',
                      color: '#f8fafc',
                      borderRadius: 6,
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      maxHeight: 140,
                      overflowY: 'auto',
                      wordBreak: 'break-all',
                    }}
                  >
                    {rawError}
                  </div>
                )}
              </div>
            )}

            <Button type="primary" onClick={onClose} block style={{ marginTop: 8 }}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
