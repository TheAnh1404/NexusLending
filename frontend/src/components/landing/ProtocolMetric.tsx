import React, { useEffect, useState } from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

interface ProtocolMetricProps {
  title: string;
  targetValue: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export const ProtocolMetric: React.FC<ProtocolMetricProps> = ({
  title,
  targetValue,
  prefix = '',
  suffix = '',
  decimals = 0,
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1200; // ms
    const stepTime = 16; // ~60fps
    const steps = duration / stepTime;
    const increment = targetValue / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= targetValue) {
        setCount(targetValue);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [targetValue]);

  const formatted = count.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <Card
      styles={{ body: { padding: '16px 20px' } }}
      style={{
        flex: 1,
        background: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(229, 231, 235, 0.5)',
        borderRadius: '16px',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.01)',
      }}
    >
      <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
        {title}
      </Text>
      <Text style={{
        fontSize: '24px',
        fontWeight: 800,
        fontFamily: 'var(--font-heading)',
        color: 'var(--text-main)',
        letterSpacing: '-0.02em',
      }}>
        {prefix}{formatted}{suffix}
      </Text>
    </Card>
  );
};
