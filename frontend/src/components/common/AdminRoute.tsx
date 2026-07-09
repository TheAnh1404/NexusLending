import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Result, Spin } from 'antd';
import { useWallet } from '../../hooks/useWallet';
import { isAdminWallet } from '../../config/admin';

interface AdminRouteProps {
  children: React.ReactElement;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const navigate = useNavigate();
  const { isLoading, publicKey } = useWallet();

  if (isLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAdminWallet(publicKey)) {
    return (
      <Result
        status="403"
        title="Admin wallet required"
        subTitle="This console is restricted to the configured Nexus admin wallet."
        extra={<Button type="primary" onClick={() => navigate('/app')}>Back to Dashboard</Button>}
      />
    );
  }

  return children;
};
