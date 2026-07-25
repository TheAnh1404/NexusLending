import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { AppSidebar } from '../components/common/AppSidebar';
import { AppHeader } from '../components/common/AppHeader';
import { MobileBottomNavigation } from '../components/common/MobileBottomNavigation';

const LIVE_WALLET_OVERVIEW_REFRESH_MS = 10_000;

export const AppLayout: React.FC = () => {
  const { wallet, connectWallet, refreshData } = useAppContext();
  const { isConnected, isLoading, publicKey } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();

  // Sync WalletContext (Freighter connection) with LendingContext (lending state)
  React.useEffect(() => {
    if (isConnected && publicKey && !wallet.connected) {
      connectWallet(publicKey);
    }
  }, [isConnected, publicKey, wallet.connected, connectWallet]);

  React.useEffect(() => {
    if (!isConnected) return;

    const syncWalletOverview = () => {
      void refreshData().catch((error) => {
        console.error('Unable to refresh wallet overview data:', error);
      });
    };

    syncWalletOverview();
    const intervalId = window.setInterval(syncWalletOverview, LIVE_WALLET_OVERVIEW_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [isConnected, refreshData]);

  // If wallet is not connected, redirect to /connect
  React.useEffect(() => {
    if (!isLoading && !isConnected) {
      navigate('/connect');
    }
  }, [isConnected, isLoading, navigate]);

  // Default page after connection is Marketplace (/app/marketplace)
  React.useEffect(() => {
    if (!isLoading && isConnected && (location.pathname === '/app' || location.pathname === '/app/')) {
      navigate('/app/marketplace', { replace: true });
    }
  }, [isConnected, isLoading, location.pathname, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-color, #f8fafc)' }}>
      {/* Fixed Vertical Left Sidebar on Desktop */}
      <AppSidebar />

      {/* Main Right Content Area (With left margin to offset fixed sidebar on desktop) */}
      <div className="app-main-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile Header Only */}
        <AppHeader />

        {/* Content Viewport */}
        <main
          className="app-main-content"
          style={{
            flex: 1,
            maxWidth: '1280px',
            width: '100%',
            margin: '0 auto',
            padding: '24px 24px 48px 24px',
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Fixed Mobile Bottom Navigation (<768px) */}
      <MobileBottomNavigation />
    </div>
  );
};

