import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useWallet } from '../../hooks/useWallet';

export const ProtectedRoute: React.FC = () => {
  const location = useLocation();
  const { isConnected, isLoading } = useWallet();

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isConnected) {
    return <Navigate to="/connect" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

