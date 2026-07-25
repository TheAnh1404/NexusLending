import React from 'react';
import { Outlet } from 'react-router-dom';
import { FaucetHeader } from '../components/faucet/FaucetHeader';

export const FaucetLayout: React.FC = () => {
  return (
    <div
      className="faucet-shell"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main, #f8fafc)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '100vw',
        minWidth: 0,
        overflowX: 'hidden',
      }}
    >
      {/* Standalone Minimal Header */}
      <FaucetHeader />

      {/* Main Centered Content */}
      <main
        style={{
          flex: 1,
          padding: '32px 16px',
          width: '100%',
          maxWidth: 'min(1200px, 100vw)',
          minWidth: 0,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};
