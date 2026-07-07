import React from 'react';
import { motion } from 'framer-motion';
import { Card, Typography } from 'antd';

const { Text } = Typography;

interface FloatingProtocolCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  value: string;
  valueColor?: string;
  badge?: string;
  badgeColor?: string;
  style?: React.CSSProperties;
  delay?: number;
  yOffset?: number;
}

export const FloatingProtocolCard: React.FC<FloatingProtocolCardProps> = ({
  icon,
  title,
  desc,
  value,
  valueColor = 'var(--text-main)',
  badge,
  badgeColor = 'var(--primary-color)',
  style,
  delay = 0,
  yOffset = 10,
}) => {
  return (
    <motion.div
      animate={{
        y: [0, -yOffset, 0],
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay,
      }}
      style={{
        position: 'absolute',
        width: '155px',
        zIndex: 10,
        ...style,
      }}
    >
      <Card
        styles={{ body: { padding: '12px' } }}
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          border: '1px solid rgba(229, 231, 235, 0.7)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.04), 0 2px 5px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'rgba(47, 128, 237, 0.08)',
            color: 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {icon}
          </div>
          <Text strong style={{ fontSize: '12px', color: 'var(--text-main)' }}>{title}</Text>
        </div>
        
        <Text type="secondary" style={{ fontSize: '10px', display: 'block', lineHeight: '1.2' }}>{desc}</Text>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
          <Text strong style={{ fontSize: '12px', color: valueColor }}>{value}</Text>
          {badge && (
            <span style={{
              background: `rgba(${badgeColor === 'var(--success-color)' ? '39, 174, 96' : '47, 128, 237'}, 0.08)`,
              color: badgeColor,
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '9px',
              fontWeight: 700,
            }}>
              {badge}
            </span>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
