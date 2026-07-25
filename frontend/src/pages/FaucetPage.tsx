import React from 'react';
import { FaucetHero } from '../components/faucet/FaucetHero';
import { FaucetRequestCard } from '../components/faucet/FaucetRequestCard';
import { FaucetFooter } from '../components/faucet/FaucetFooter';

export const FaucetPage: React.FC = () => {
  return (
    <div className="faucet-page" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', maxWidth: '100%', minWidth: 0 }}>
      {/* Hero Section */}
      <FaucetHero />

      {/* Main Request Card */}
      <FaucetRequestCard />

      {/* Footer Section */}
      <FaucetFooter />
    </div>
  );
};
