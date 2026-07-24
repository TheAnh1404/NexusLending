import React, { useState } from 'react';
import { Skeleton, Card, Button, Typography, Row, Col } from 'antd';
import { ShoppingBag, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

export const EmptyPortfolio: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        border: '1px solid var(--border-color, #e2e8f0)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: 'rgba(79, 70, 229, 0.08)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--primary-color, #4f46e5)',
          marginBottom: 16,
        }}
      >
        <ShoppingBag size={28} />
      </div>
      <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>
        No Portfolio Yet
      </Title>
      <Paragraph type="secondary" style={{ maxWidth: 420, margin: '0 auto 20px auto', fontSize: 14 }}>
        Start lending or borrowing liquidity on Stellar Soroban to build your active portfolio.
      </Paragraph>
      <Button
        type="primary"
        size="large"
        onClick={() => navigate('/app/marketplace')}
        style={{ borderRadius: 10, fontWeight: 700 }}
      >
        Explore Marketplace
      </Button>
    </div>
  );
};

export const PortfolioSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    <Row gutter={[16, 16]}>
      {[1, 2, 3, 4].map((i) => (
        <Col xs={24} sm={12} lg={6} key={i}>
          <Card className="card-premium" styles={{ body: { padding: 16 } }}>
            <Skeleton active paragraph={{ rows: 1 }} />
          </Card>
        </Col>
      ))}
    </Row>
    <Card className="card-premium" styles={{ body: { padding: 24 } }}>
      <Skeleton active paragraph={{ rows: 4 }} />
    </Card>
  </div>
);

interface ErrorPortfolioProps {
  onRetry: () => void;
  rawError?: string;
}

export const ErrorPortfolio: React.FC<ErrorPortfolioProps> = ({ onRetry, rawError }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        border: '1px solid #fecaca',
      }}
    >
      <AlertTriangle size={42} style={{ color: 'var(--danger-color, #ef4444)', marginBottom: 12 }} />
      <Title level={4} style={{ margin: '0 0 8px 0', fontWeight: 800 }}>
        Unable to load portfolio
      </Title>
      <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 20 }}>
        Please check your network connection and try again.
      </Paragraph>
      <Button
        type="primary"
        icon={<RefreshCw size={16} />}
        onClick={onRetry}
        style={{ borderRadius: 8, fontWeight: 600 }}
      >
        Retry
      </Button>

      {rawError && (
        <div style={{ marginTop: 24 }}>
          <Button
            type="link"
            size="small"
            onClick={() => setShowDetails(!showDetails)}
            style={{ color: 'var(--text-muted)', fontSize: 12 }}
          >
            {showDetails ? 'Hide Technical Details' : 'View Technical Details'}
          </Button>
          {showDetails && (
            <pre
              style={{
                marginTop: 12,
                padding: 12,
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                borderRadius: 8,
                fontSize: 11,
                textAlign: 'left',
                overflowX: 'auto',
                border: '1px solid var(--border-light, #e2e8f0)',
              }}
            >
              {rawError}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
