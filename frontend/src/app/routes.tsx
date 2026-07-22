import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import { PublicLayout } from '../layouts/PublicLayout';
import { AppLayout } from '../layouts/AppLayout';
import { ProtectedRoute } from '../components/common/ProtectedRoute';
import { AdminRoute } from '../components/common/AdminRoute';

// Pages
import { LandingPage } from '../pages/LandingPage';
import { ConnectPage } from '../pages/ConnectPage';
import { DashboardPage } from '../pages/DashboardPage';
import { MarketplacePage } from '../pages/MarketplacePage';
import { CreateLoanPage } from '../pages/CreateLoanPage';
import { LoanDetailPage } from '../pages/LoanDetailPage';
import { BorrowLoanPage } from '../pages/BorrowLoanPage';
import { BorrowerDashboardPage } from '../pages/BorrowerDashboardPage';
import { LenderDashboardPage } from '../pages/LenderDashboardPage';
import { LiquidationCenterPage } from '../pages/LiquidationCenterPage';
import { LiquidationDetailPage } from '../pages/LiquidationDetailPage';
import { OracleMonitorPage } from '../pages/OracleMonitorPage';
import { MyLoansPage } from '../pages/MyLoansPage';
import { TransactionsPage } from '../pages/TransactionsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AdminPage } from '../pages/AdminPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/connect" element={<ConnectPage />} />
      </Route>

      {/* Dashboard App Pages */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="create-loan" element={<CreateLoanPage />} />
          <Route path="loans/:id" element={<LoanDetailPage />} />
          <Route path="borrow/:id" element={<BorrowLoanPage />} />
          <Route path="borrower" element={<BorrowerDashboardPage />} />
          <Route path="lender" element={<LenderDashboardPage />} />
          <Route path="liquidation" element={<LiquidationCenterPage />} />
          <Route path="liquidation/:id" element={<LiquidationDetailPage />} />
          <Route path="oracle" element={<AdminRoute><OracleMonitorPage /></AdminRoute>} />
          <Route path="my-loans" element={<MyLoansPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
