import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { DATA_MODE } from '../services/api/client';
import { freighterService } from '../services/wallet/freighter.service';
import { Alert, Button, Card, Space, Tag, Typography, message } from 'antd';
import { ArrowLeft, ExternalLink, Layers, ShieldCheck, Wallet } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const ConnectPage: React.FC = () => {
  const { connectWallet: connectDemoWallet } = useAppContext();
  const {
    connect,
    connectMockWallet,
    isConnected,
    publicKey,
    shortAddress,
    network,
    isTestnet,
    isLoading,
    error,
    refreshWallet,
  } = useWallet();
  const navigate = useNavigate();
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    void freighterService.isFreighterAvailable().then((available) => {
      if (mounted) setIsAvailable(available);
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Automatic redirect if already connected
  useEffect(() => {
    if (isConnected && publicKey) {
      connectDemoWallet(publicKey);
      navigate('/app');
    }
  }, [isConnected, publicKey, connectDemoWallet, navigate]);

  const handleConnect = async () => {
    try {
      const connection = await connect();
      connectDemoWallet(connection.publicKey);

      if (!connection.isTestnet) {
        message.warning('Freighter is connected, but the selected network is not Stellar Testnet.');
      } else {
        message.success('Freighter wallet connected on Stellar Testnet.');
      }

      navigate('/app');
    } catch (connectError) {
      message.error(connectError instanceof Error ? connectError.message : 'Unable to connect Freighter wallet.');
    }
  };

  const handleRefresh = async () => {
    await refreshWallet();
  };

  const handleLaunch = () => {
    if (publicKey) {
      connectDemoWallet(publicKey);
    }
    navigate('/app');
  };

  const handleConnectMock = () => {
    const mockAddress = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    localStorage.setItem('nexus_data_mode', 'mock');
    if (DATA_MODE !== 'mock') {
      window.location.assign('/app');
      return;
    }
    connectMockWallet(mockAddress);
    connectDemoWallet(mockAddress);
    message.success('Sandbox mock wallet connected successfully in Mock Mode.');
    navigate('/app');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      backgroundColor: 'var(--bg-color)'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '480px',
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          backgroundColor: '#FFFFFF'
        }}
        styles={{ body: { padding: '40px' } }}
      >
        <Button
          type="text"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: 0, marginBottom: '24px', color: 'var(--text-muted)' }}
        >
          Back to Home
        </Button>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            background: 'linear-gradient(135deg, var(--primary-color) 0%, #6366F1 100%)',
            borderRadius: '12px',
            color: 'white',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.2)'
          }}>
            <Layers size={24} />
          </div>
          <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '24px', letterSpacing: '-0.02em' }}>
            Connect to Nexus Lending
          </Title>
          <Paragraph type="secondary" style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>
            Access peer-to-peer fixed-rate markets on the Stellar Network.
          </Paragraph>
        </div>

        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          {isAvailable === false && (
            <Alert
              type="warning"
              showIcon
              title="Freighter is not installed"
              description={
                <span>
                  Please install the Freighter browser extension to continue.{' '}
                  <a href="https://freighter.app" target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                    Install Freighter <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
                  </a>
                </span>
              }
            />
          )}

          {error && (
            <Alert
              type={isConnected && !isTestnet ? 'warning' : 'error'}
              showIcon
              title={isConnected && !isTestnet ? 'Wrong Network Selected' : 'Wallet Connection Error'}
              description={error}
            />
          )}

          {isConnected && (
            <Alert
              type={isTestnet ? 'success' : 'warning'}
              showIcon
              title={isTestnet ? 'Freighter Session Active' : 'Change Network Required'}
              description={
                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>Address: <Text code style={{ fontFamily: 'var(--font-mono)' }}>{shortAddress}</Text></span>
                  <span>Network: <Text strong>{network ?? 'Unknown'}</Text></span>
                </div>
              }
            />
          )}

          <div style={{
            padding: '14px 16px',
            backgroundColor: 'var(--border-light)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <Text strong style={{ display: 'block', fontSize: '12px', color: 'var(--text-main)' }}>WALLET PROVIDER</Text>
              <Text type="secondary" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {isConnected ? 'Active session' : 'Freighter extension'}
              </Text>
            </div>
            <Tag color={isConnected ? (isTestnet ? 'success' : 'warning') : 'default'} style={{ border: 'none', margin: 0, fontWeight: 700 }}>
              {isConnected ? (isTestnet ? 'Stellar Testnet' : 'Wrong Net') : 'Disconnected'}
            </Tag>
          </div>

          <div style={{
            padding: '14px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.04)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start'
          }}>
            <ShieldCheck size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <Text strong style={{ fontSize: '12px', display: 'block', color: 'var(--text-main)' }}>
                Secure Key Custody
              </Text>
              <Text type="secondary" style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--text-muted)' }}>
                Nexus handles transactions securely. All key signatures are controlled by Freighter; we do not store private keys.
              </Text>
            </div>
          </div>

          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            <Button
              type="primary"
              size="large"
              icon={<Wallet size={16} style={{ marginRight: 6 }} />}
              onClick={isConnected ? handleLaunch : handleConnect}
              loading={isLoading}
              disabled={isAvailable === false}
              style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isConnected ? 'Launch Dashboard' : 'Connect Wallet'}
            </Button>
            {(!isConnected || isAvailable === false) && (
              <Button
                type="default"
                size="large"
                onClick={handleConnectMock}
                style={{
                  width: '100%',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderColor: 'var(--primary-color)',
                  color: 'var(--primary-color)',
                  marginTop: '8px'
                }}
              >
                Use Sandbox Wallet (Mock Mode)
              </Button>
            )}
            {isConnected && (
              <Button
                size="large"
                onClick={handleRefresh}
                loading={isLoading}
                style={{ width: '100%', height: '42px' }}
              >
                Sync Status
              </Button>
            )}
          </Space>
        </Space>
      </Card>
    </div>
  );
};
