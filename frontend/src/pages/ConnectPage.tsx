import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { freighterService } from '../services/wallet/freighter.service';
import { Alert, Button, Card, Divider, Radio, Space, Tag, Typography, message } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { ArrowLeft, ExternalLink, Layers, ShieldCheck, Wallet } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const ConnectPage: React.FC = () => {
  const { connectWallet: connectDemoWallet } = useAppContext();
  const {
    connect,
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
  const [role, setRole] = useState<'LENDER' | 'BORROWER' | 'LIQUIDATOR'>('BORROWER');
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

  const handleRoleChange = (e: RadioChangeEvent) => {
    const selectedRole = e.target.value as 'LENDER' | 'BORROWER' | 'LIQUIDATOR';
    setRole(selectedRole);
  };

  const handleConnect = async () => {
    try {
      const connection = await connect();
      connectDemoWallet(connection.publicKey, role);

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
      connectDemoWallet(publicKey, role);
    }
    navigate('/app');
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 140px)',
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
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-color)'
        }}
        styles={{ body: { padding: '40px' } }}
      >
        <Button
          type="text"
          icon={<ArrowLeft size={16} />}
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
            width: '48px',
            height: '48px',
            background: 'var(--primary-color)',
            borderRadius: '12px',
            color: 'white',
            marginBottom: '16px',
            boxShadow: '0 6px 15px rgba(47, 128, 237, 0.25)'
          }}>
            <Layers size={22} />
          </div>
          <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Connect Your Wallet
          </Title>
          <Paragraph type="secondary" style={{ fontSize: '13px', marginTop: '6px' }}>
            Connect Freighter on Stellar Testnet to interact with the Nexus lending app.
          </Paragraph>
        </div>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {isAvailable === false && (
            <Alert
              type="warning"
              showIcon
              message="Freighter is not installed"
              description={
                <span>
                  Install the Freighter browser extension, unlock it, then return here to connect.{' '}
                  <a href="https://freighter.app" target="_blank" rel="noreferrer">
                    Install Freighter <ExternalLink size={12} style={{ verticalAlign: '-2px' }} />
                  </a>
                </span>
              }
            />
          )}

          {error && (
            <Alert
              type={isConnected && !isTestnet ? 'warning' : 'error'}
              showIcon
              message={isConnected && !isTestnet ? 'Wrong network selected' : 'Wallet connection error'}
              description={error}
            />
          )}

          {isConnected && (
            <Alert
              type={isTestnet ? 'success' : 'warning'}
              showIcon
              message={isTestnet ? 'Freighter connected' : 'Freighter connected to a non-Testnet network'}
              description={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>
                    Address: <Text code>{shortAddress}</Text>
                  </span>
                  <span>
                    Network: <Text strong>{network ?? 'Unknown Network'}</Text>
                  </span>
                  {!isTestnet && <span>Switch Freighter to Stellar Testnet before submitting transactions.</span>}
                </div>
              }
            />
          )}

          <div>
            <Text strong style={{ display: 'block', marginBottom: '10px', fontSize: '13px' }}>
              SELECT DEMO ROLE:
            </Text>
            <Radio.Group
              value={role}
              onChange={handleRoleChange}
              buttonStyle="solid"
              style={{ width: '100%', display: 'flex' }}
            >
              <Radio.Button value="BORROWER" style={{ flex: 1, textAlign: 'center', height: '40px', lineHeight: '38px' }}>
                Borrower
              </Radio.Button>
              <Radio.Button value="LENDER" style={{ flex: 1, textAlign: 'center', height: '40px', lineHeight: '38px' }}>
                Lender
              </Radio.Button>
              <Radio.Button value="LIQUIDATOR" style={{ flex: 1, textAlign: 'center', height: '40px', lineHeight: '38px' }}>
                Liquidator
              </Radio.Button>
            </Radio.Group>
          </div>

          <div style={{
            padding: '14px 16px',
            backgroundColor: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            alignItems: 'center'
          }}>
            <div>
              <Text strong style={{ display: 'block', fontSize: '12px' }}>WALLET STATUS</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {isConnected ? 'Freighter session active' : 'No wallet connected'}
              </Text>
            </div>
            <Tag color={isConnected ? (isTestnet ? 'success' : 'warning') : 'default'} style={{ border: 'none', margin: 0 }}>
              {isConnected ? (network ?? 'Connected') : 'Disconnected'}
            </Tag>
          </div>

          <div style={{
            padding: '16px',
            backgroundColor: 'var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start'
          }}>
            <ShieldCheck size={18} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <Text strong style={{ fontSize: '12px', display: 'block', color: 'var(--text-main)' }}>
                Freighter Signing
              </Text>
              <Text type="secondary" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                Nexus never sees your private key. Freighter approves access and signs Stellar Testnet transactions in your browser.
              </Text>
            </div>
          </div>

          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Button
              type="primary"
              size="large"
              icon={<Wallet size={18} style={{ marginRight: 8 }} />}
              onClick={isConnected ? handleLaunch : handleConnect}
              loading={isLoading}
              disabled={isAvailable === false}
              style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isConnected ? 'Launch App' : 'Connect Freighter Wallet'}
            </Button>
            {isConnected && (
              <Button
                size="large"
                onClick={handleRefresh}
                loading={isLoading}
                style={{ width: '100%' }}
              >
                Refresh Wallet
              </Button>
            )}
          </Space>
        </Space>

        <Divider style={{ margin: '24px 0' }} />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Demo balances are still simulated by role until contract event indexing is connected.
          </Text>
        </div>
      </Card>
    </div>
  );
};

