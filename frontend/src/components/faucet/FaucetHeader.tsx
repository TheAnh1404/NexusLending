import React from 'react';
import { Link } from 'react-router-dom';
import { Typography } from 'antd';
import { TestnetBadge } from './TestnetBadge';
import { BackToNexusLink } from './BackToNexusLink';
import { AppLogo } from '../common/AppLogo';

const { Text } = Typography;

export const FaucetHeader: React.FC = () => {
  return (
    <header
      className="faucet-header"
      style={{
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        height: 64,
        padding: '0 24px',
        backgroundColor: 'var(--bg-elevated, #ffffff)',
        borderBottom: '1px solid var(--border-light, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        position: 'sticky',
        left: 0,
        right: 0,
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Brand & Faucet Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, overflow: 'hidden' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <AppLogo size="small" />
        </Link>
        <span className="hide-mobile" style={{ color: 'var(--border-color)', fontWeight: 300 }}>|</span>
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary-color, #4f46e5)' }}>
            TESTNET FAUCET
          </Text>
        </div>
      </div>

      {/* Right Controls: Testnet badge & Back link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 0 }}>
        <div className="desktop-only" style={{ display: 'flex', alignItems: 'center' }}>
          <TestnetBadge />
        </div>
        <BackToNexusLink customText="Nexus" />
      </div>
    </header>
  );
};
