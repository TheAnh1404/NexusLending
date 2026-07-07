import React from 'react';
import { motion } from 'framer-motion';
import { Typography } from 'antd';

const { Text } = Typography;

interface FeatureMiniCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

export const FeatureMiniCard: React.FC<FeatureMiniCardProps> = ({ icon, title, desc }) => {
  return (
    <motion.div
      whileHover={{ y: -6, boxShadow: '0 12px 30px rgba(47, 128, 237, 0.08)', borderColor: 'rgba(47, 128, 237, 0.3)' }}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        flex: 1,
        minWidth: '160px',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(229, 231, 235, 0.8)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        cursor: 'default',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.01)',
      }}
    >
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(47, 128, 237, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%)',
        color: '#2F80ED',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <Text strong style={{ fontSize: '13px', display: 'block', color: 'var(--text-main)' }}>{title}</Text>
        <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '2px', lineHeight: '1.3' }}>{desc}</Text>
      </div>
    </motion.div>
  );
};
