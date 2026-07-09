import React from 'react';
import { useAppContext } from '../../app/AppContext';
import { isAdminWallet } from '../../config/admin';
import { Card, Space, Typography, Tag } from 'antd';
import { LineChart, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const { Text, Title } = Typography;

export const OraclePriceWidget: React.FC = () => {
  const { oraclePrices, wallet } = useAppContext();
  const xlmPriceInfo = oraclePrices.find((p) => p.asset === 'XLM');
  const isAdmin = isAdminWallet(wallet.address);

  if (!xlmPriceInfo) return null;

  const isPositive = xlmPriceInfo.change24h >= 0;

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LineChart size={16} style={{ color: 'var(--primary-color)' }} />
          <span>Stellar Anchor Oracles</span>
        </div>
      }
      extra={isAdmin ? (
        <Link to="/app/oracle" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-color)' }}>
          Monitor
        </Link>
      ) : null}
      styles={{ body: { padding: '20px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Space align="center" size="small">
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              backgroundColor: '#FFE3E3',
              borderRadius: '50%',
              fontSize: '11px',
              fontWeight: 700,
              color: '#D32F2F',
            }}>
              X
            </span>
            <Text strong style={{ fontSize: '15px' }}>XLM / USDC</Text>
          </Space>
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <Title level={4} style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
              ${xlmPriceInfo.price.toFixed(4)}
            </Title>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              fontSize: '12px',
              fontWeight: 600,
              color: isPositive ? 'var(--success-color)' : 'var(--danger-color)',
            }}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isPositive ? '+' : ''}{xlmPriceInfo.change24h}%
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <Tag color="blue" style={{ border: 'none', margin: 0, fontSize: '10px' }}>
            {xlmPriceInfo.source.split(' ')[0]} Feed
          </Tag>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={10} />
            {new Date(xlmPriceInfo.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>
    </Card>
  );
};

