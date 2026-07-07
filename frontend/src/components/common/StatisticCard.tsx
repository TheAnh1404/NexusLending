import React from 'react';
import { Card, Statistic, Typography } from 'antd';

const { Text } = Typography;

interface StatisticCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
  loading?: boolean;
}

export const StatisticCard: React.FC<StatisticCardProps> = ({
  title,
  value,
  icon,
  trend,
  loading = false,
}) => {
  return (
    <Card loading={loading} style={{ minHeight: 132 }} styles={{ body: { padding: '20px' } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
        <Statistic
          title={title}
          value={value}
          styles={{
            content: {
              fontSize: 26,
              lineHeight: 1.15,
              fontWeight: 700,
              color: 'var(--text-main)',
              fontFamily: 'var(--font-heading)',
              wordBreak: 'break-word',
            }
          }}
        />
        {icon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 42,
              height: 42,
              minWidth: 42,
              borderRadius: 8,
              backgroundColor: 'rgba(47, 128, 237, 0.08)',
              color: 'var(--primary-color)',
            }}
          >
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: trend.isPositive ? 'var(--success-color)' : 'var(--danger-color)',
              backgroundColor: trend.isPositive ? 'rgba(39, 174, 96, 0.08)' : 'rgba(235, 87, 87, 0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {trend.value}
          </span>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            protocol trend
          </Text>
        </div>
      )}
    </Card>
  );
};
