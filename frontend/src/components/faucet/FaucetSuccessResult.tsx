import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Typography, Card } from 'antd';
import { CheckCircle2, ExternalLink, ArrowRight } from 'lucide-react';
import { type FaucetClaimResult } from '../../services/faucet/faucetService';

const { Title, Text, Paragraph } = Typography;

interface FaucetSuccessResultProps {
  result: FaucetClaimResult;
  onReset: () => void;
}

export const FaucetSuccessResult: React.FC<FaucetSuccessResultProps> = ({ result, onReset }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawReturnTo = searchParams.get('returnTo');
  const hasValidReturnTo =
    rawReturnTo &&
    typeof rawReturnTo === 'string' &&
    rawReturnTo.startsWith('/') &&
    !rawReturnTo.startsWith('//') &&
    !rawReturnTo.toLowerCase().includes('http');

  const getReturnLabel = () => {
    if (!hasValidReturnTo) return 'Open Nexus App';
    if (rawReturnTo.includes('marketplace')) return 'Return to Marketplace';
    if (rawReturnTo.includes('my-loans')) return 'Return to My Loans';
    if (rawReturnTo.includes('portfolio')) return 'Return to Portfolio';
    return 'Return to Nexus';
  };

  const handleReturnToApp = () => {
    if (hasValidReturnTo) {
      navigate(rawReturnTo);
    } else {
      navigate('/app/marketplace');
    }
  };

  return (
    <Card
      styles={{ body: { padding: 24 } }}
      style={{
        borderRadius: 16,
        border: '1px solid rgba(16, 185, 129, 0.3)',
        backgroundColor: 'rgba(16, 185, 129, 0.04)',
        marginTop: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          color: 'var(--success-color, #10b981)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <CheckCircle2 size={32} />
      </div>

      <Title level={3} style={{ margin: 0, fontWeight: 900 }}>
        Test Tokens Received
      </Title>

      <Paragraph type="secondary" style={{ marginTop: 4, fontSize: 14 }}>
        <Text strong style={{ color: 'var(--success-color)' }}>
          {result.amount} {result.asset}
        </Text>{' '}
        has been sent to your wallet.
      </Paragraph>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: '14px 16px',
          border: '1px solid var(--border-light, #e2e8f0)',
          margin: '16px 0',
          textAlign: 'left',
          fontSize: 13,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Destination Wallet</Text>
          <Text strong style={{ fontFamily: 'monospace' }}>
            {result.walletAddress.slice(0, 8)}...{result.walletAddress.slice(-8)}
          </Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Claim Amount</Text>
          <Text strong>{result.amount} {result.asset}</Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">Next Request</Text>
          <Text strong style={{ color: 'var(--primary-color)' }}>
            {new Date(result.nextAvailableAt).toLocaleString()}
          </Text>
        </div>

        {result.txHash && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">Transaction Hash</Text>
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 12 }}
            >
              <span>{result.txHash.slice(0, 10)}...</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          type="primary"
          size="large"
          onClick={handleReturnToApp}
          icon={<ArrowRight size={16} />}
          style={{ borderRadius: 10, fontWeight: 700, minWidth: 160 }}
        >
          {getReturnLabel()}
        </Button>

        <Button onClick={onReset} style={{ borderRadius: 10, fontWeight: 600 }}>
          Request Another Asset
        </Button>
      </div>
    </Card>
  );
};
