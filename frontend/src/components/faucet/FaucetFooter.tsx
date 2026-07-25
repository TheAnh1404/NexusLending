import React from 'react';
import { Typography } from 'antd';
import { BackToNexusLink } from './BackToNexusLink';

const { Text } = Typography;

export const FaucetFooter: React.FC = () => {
  return (
    <footer
      style={{
        marginTop: 40,
        paddingTop: 24,
        borderTop: '1px solid var(--border-light, #e2e8f0)',
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-muted)',
        width: '100%',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <BackToNexusLink customText="Return to Nexus Lending App" />

        <Text type="secondary" style={{ fontSize: 11, maxWidth: 480, margin: '8px auto 0 auto' }}>
          Nexus Stellar Testnet Faucet is an independent developer tool. Tokens issued on Stellar Testnet have zero commercial or financial value and cannot be transferred to Mainnet.
        </Text>

        <div style={{ fontSize: 11, marginTop: 4 }}>
          &copy; {new Date().getFullYear()} Nexus Finance &bull; Stellar Soroban Peer-to-Peer Protocol
        </div>
      </div>
    </footer>
  );
};
