import React, { useState } from 'react';
import { Typography, Alert, Button, message } from 'antd';
import { Info, RotateCcw } from 'lucide-react';
import { faucetService } from '../../services/faucet/faucetService';

const { Title, Paragraph } = Typography;

export const FaucetHero: React.FC = () => {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await faucetService.resetFaucetState();
      message.success('Faucet cooldowns reset successfully! All limits cleared.');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch {
      message.error('Failed to reset faucet state.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="faucet-hero" style={{ textAlign: 'center', maxWidth: 600, width: '100%', minWidth: 0, margin: '0 auto 28px auto', boxSizing: 'border-box' }}>
      <Title level={2} style={{ margin: 0, fontWeight: 900, fontSize: 26, letterSpacing: 0 }}>
        Stellar Testnet Faucet
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 14, lineHeight: '1.6' }}>
        Get free test assets to explore lending, borrowing and collateral management on Nexus.
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        icon={<Info size={16} />}
        message={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Testnet Notice</span>
            <Button
              size="small"
              type="text"
              icon={<RotateCcw size={12} />}
              loading={resetting}
              onClick={handleReset}
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary-color)' }}
            >
              Reset
            </Button>
          </div>
        }
        description="These assets work only on Stellar Testnet and have no real monetary value."
        style={{
          borderRadius: 12,
          textAlign: 'left',
          fontSize: 13,
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        }}
      />
    </div>
  );
};
