import React from 'react';
import { Button, Typography, Card, Collapse } from 'antd';
import { AlertCircle, ChevronDown, RefreshCw } from 'lucide-react';

const { Title, Text, Paragraph } = Typography;

interface FaucetErrorResultProps {
  errorMessage: string;
  technicalDetails?: {
    errorCode?: string;
    rawError?: string;
    requestId?: string;
    txHash?: string;
  };
  onRetry: () => void;
}

export const FaucetErrorResult: React.FC<FaucetErrorResultProps> = ({
  errorMessage,
  technicalDetails,
  onRetry,
}) => {
  return (
    <Card
      styles={{ body: { padding: 24 } }}
      style={{
        borderRadius: 16,
        border: '1px solid rgba(239, 68, 68, 0.3)',
        backgroundColor: 'rgba(239, 68, 68, 0.04)',
        marginTop: 16,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          <AlertCircle size={28} />
        </div>

        <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
          Request Unsuccessful
        </Title>

        <Paragraph type="secondary" style={{ marginTop: 6, fontSize: 13, color: '#dc2626' }}>
          {errorMessage || 'We could not send the test tokens. Check the wallet address and try again.'}
        </Paragraph>
      </div>

      {technicalDetails && (
        <Collapse
          ghost
          expandIcon={({ isActive }) => (
            <ChevronDown size={14} style={{ transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          )}
          style={{ marginBottom: 16, backgroundColor: '#ffffff', borderRadius: 8 }}
          items={[
            {
              key: '1',
              label: <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Technical Details</Text>,
              children: (
                <div style={{ fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {technicalDetails.errorCode && <div>Error Code: {technicalDetails.errorCode}</div>}
                  {technicalDetails.requestId && <div>Request ID: {technicalDetails.requestId}</div>}
                  {technicalDetails.txHash && <div>Transaction Hash: {technicalDetails.txHash}</div>}
                  {technicalDetails.rawError && <div>Raw Error: {technicalDetails.rawError}</div>}
                </div>
              ),
            },
          ]}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          type="primary"
          danger
          onClick={onRetry}
          icon={<RefreshCw size={15} />}
          style={{ borderRadius: 8, fontWeight: 600 }}
        >
          Try Again
        </Button>
      </div>
    </Card>
  );
};
