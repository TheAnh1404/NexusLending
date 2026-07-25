import React from 'react';
import { Card, Typography, Tag } from 'antd';
import { ExternalLink, History } from 'lucide-react';
import { type FaucetClaimResult } from '../../services/faucet/faucetService';

const { Title } = Typography;

interface FaucetRecentRequestsProps {
  requests: FaucetClaimResult[];
}

export const FaucetRecentRequests: React.FC<FaucetRecentRequestsProps> = ({ requests }) => {
  if (!requests || requests.length === 0) return null;

  return (
    <Card
      styles={{ body: { padding: 16 } }}
      style={{
        borderRadius: 16,
        border: '1px solid var(--border-light, #e2e8f0)',
        marginTop: 24,
        width: '100%',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <History size={16} style={{ color: 'var(--primary-color)' }} />
        <Title level={5} style={{ margin: 0, fontWeight: 700 }}>
          Recent Session Requests
        </Title>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {requests.map((req) => (
          <div
            key={req.requestId}
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              borderRadius: 10,
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{req.asset}</span>
                <Tag color="success" style={{ borderRadius: 6, fontSize: 10, padding: '0 6px' }}>
                  Completed
                </Tag>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                Claimed {req.amount} {req.asset}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              {req.txHash ? (
                <a
                  href={req.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 11 }}
                >
                  <span>View Tx</span>
                  <ExternalLink size={11} />
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>No Tx</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
