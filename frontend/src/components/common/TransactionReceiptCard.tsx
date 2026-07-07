import React from 'react';
import { Card, Steps, Button, Typography, Tag, Space } from 'antd';
import { CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, FileText } from 'lucide-react';

const { Text } = Typography;

export interface TransactionReceiptCardProps {
  status: 'preparing' | 'signing' | 'submitting' | 'confirming' | 'confirmed' | 'failed';
  txHash?: string;
  explorerUrl?: string;
  ledger?: number;
  amount?: number;
  asset?: string;
  actionName: string;
  errorDetails?: string;
  onClose?: () => void;
}

export const TransactionReceiptCard: React.FC<TransactionReceiptCardProps> = ({
  status,
  txHash,
  explorerUrl,
  ledger,
  amount,
  asset,
  actionName,
  errorDetails,
  onClose,
}) => {
  const getStepIndex = () => {
    switch (status) {
      case 'preparing':
        return 0;
      case 'signing':
        return 1;
      case 'submitting':
        return 2;
      case 'confirming':
        return 3;
      case 'confirmed':
        return 4;
      case 'failed':
        return 4;
      default:
        return 0;
    }
  };

  const steps = [
    { title: 'Preparing' },
    { title: 'Signature' },
    { title: 'Submitting' },
    { title: 'Confirming' },
    { title: 'Complete' },
  ];

  const currentStep = getStepIndex();
  const isFailed = status === 'failed';
  const isPending = !isFailed && status !== 'confirmed';

  return (
    <Card
      style={{
        border: isFailed ? '1px solid var(--danger-color)' : isPending ? '1px solid var(--primary-color)' : '1px solid var(--success-color)',
        boxShadow: 'var(--shadow-md)',
        background: '#FFFFFF',
      }}
      title={
        <Space size={8}>
          <FileText size={18} style={{ color: 'var(--primary-color)' }} />
          <span>Soroban Transaction Receipt</span>
        </Space>
      }
      extra={
        status === 'confirmed' ? (
          <Tag color="success">SUCCESS</Tag>
        ) : isFailed ? (
          <Tag color="error">FAILED</Tag>
        ) : (
          <Tag color="processing" icon={<RefreshCw size={10} className="spin-animation" />}>
            PENDING
          </Tag>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Step Indicator */}
        <Steps
          size="small"
          current={currentStep}
          status={isFailed ? 'error' : isPending ? 'process' : 'finish'}
          items={steps}
        />

        <DividerLight />

        {/* Transaction Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Action Performed:</Text>
            <Text strong>{actionName}</Text>
          </div>
          {amount !== undefined && asset && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Token Value:</Text>
              <Text strong style={{ color: 'var(--success-color)' }}>
                {amount.toLocaleString()} {asset}
              </Text>
            </div>
          )}
          {txHash && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Text type="secondary">Transaction Hash:</Text>
              <div style={{ textAlign: 'right' }}>
                <Text copyable={{ text: txHash }} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {txHash.slice(0, 8)}...{txHash.slice(-8)}
                </Text>
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', justifyContent: 'flex-end', marginTop: '2px' }}
                  >
                    View on Stellar Expert <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          )}
          {ledger && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Stellar Ledger:</Text>
              <Text style={{ fontFamily: 'var(--font-mono)' }}>#{ledger}</Text>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text type="secondary">Network Gas Fee:</Text>
            <Text style={{ fontFamily: 'var(--font-mono)' }}>0.01 XLM</Text>
          </div>
        </div>

        {/* Action / Error Details */}
        {isFailed && errorDetails && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.04)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: '6px',
            color: 'var(--danger-color)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px'
          }}>
            <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong>Execution Error:</strong> {errorDetails}
            </div>
          </div>
        )}

        {status === 'confirmed' && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: '6px',
            color: 'var(--success-color)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px'
          }}>
            <CheckCircle2 size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong>Transaction Settled:</strong> On-chain state updated. The Stellar ledger consensus confirmed this transaction successfully.
            </div>
          </div>
        )}

        {onClose && (status === 'confirmed' || isFailed) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button type={isFailed ? 'default' : 'primary'} onClick={onClose}>
              Dismiss Receipt
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

const DividerLight = () => (
  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }} />
);
