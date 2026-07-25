import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import { PublicLayout } from '../layouts/PublicLayout';
import { AppLayout } from '../layouts/AppLayout';
import { FaucetLayout } from '../layouts/FaucetLayout';
import { ProtectedRoute } from '../components/common/ProtectedRoute';

// Pages
import { LandingPage } from '../pages/LandingPage';
import { ConnectPage } from '../pages/ConnectPage';
import { MarketplacePage } from '../pages/MarketplacePage';
import { MyLoansPage } from '../pages/MyLoansPage';
import { PortfolioPage } from '../pages/PortfolioPage';
import { SettingsPage } from '../pages/SettingsPage';
import { FaucetPage } from '../pages/FaucetPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Standalone Faucet Route */}
      <Route element={<FaucetLayout />}>
        <Route path="/faucet" element={<FaucetPage />} />
      </Route>

      {/* Redirect legacy /swap to /faucet */}
      <Route path="/swap" element={<Navigate to="/faucet" replace />} />

      {/* Public Landing & Connect */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/connect" element={<ConnectPage />} />
      </Route>

      {/* Main 4 Protected Application Pages */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/marketplace" replace />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="my-loans" element={<MyLoansPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="settings" element={<SettingsPage />} />

          {/* Backward compatibility redirects */}
          <Route path="swap" element={<Navigate to="/faucet" replace />} />
          <Route path="create-loan" element={<Navigate to="/app/marketplace" replace />} />
          <Route path="borrow/:id" element={<Navigate to="/app/marketplace" replace />} />
          <Route path="loans/:id" element={<Navigate to="/app/my-loans" replace />} />
          <Route path="borrower" element={<Navigate to="/app/my-loans" replace />} />
          <Route path="lender" element={<Navigate to="/app/my-loans" replace />} />
          <Route path="liquidation" element={<Navigate to="/app/my-loans" replace />} />
          <Route path="liquidation/:id" element={<Navigate to="/app/my-loans" replace />} />
          <Route path="oracle" element={<Navigate to="/app/settings" replace />} />
          <Route path="transactions" element={<Navigate to="/app/settings" replace />} />
          <Route path="admin" element={<Navigate to="/app/settings" replace />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

