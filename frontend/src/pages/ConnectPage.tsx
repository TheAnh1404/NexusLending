import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { DATA_MODE, DEFAULT_MOCK_WALLET_ADDRESS, switchToMockMode } from '../services/api/client';
import { freighterService } from '../services/wallet/freighter.service';
import { Alert, App, Button, Card, Space, Tag, Typography, Row, Col } from 'antd';
import { 
  ArrowLeft, 
  ExternalLink, 
  Layers, 
  ShieldCheck, 
  Wallet, 
  Coins, 
  Zap, 
  Gauge, 
  RefreshCw
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const ConnectPage: React.FC = () => {
  const { connectWallet: connectDemoWallet } = useAppContext();
  const { message } = App.useApp();
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
  const [selectedRole, setSelectedRole] = useState<'LENDER' | 'BORROWER' | 'LIQUIDATOR' | null>(null);

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

  const handleConnectMock = (role?: 'LENDER' | 'BORROWER' | 'LIQUIDATOR') => {
    const mockAddress = DEFAULT_MOCK_WALLET_ADDRESS;
    if (DATA_MODE !== 'mock') {
      switchToMockMode('/app', mockAddress);
      return;
    }
    connectMockWallet(mockAddress);
    connectDemoWallet(mockAddress);
    
    // Auto navigate to the correct dashboard based on selected role
    message.success(`Sandbox wallet connected in Mock Mode.`);
    if (role === 'LENDER') {
      navigate('/app/lender');
    } else if (role === 'BORROWER') {
      navigate('/app/borrower');
    } else if (role === 'LIQUIDATOR') {
      navigate('/app/liquidation');
    } else {
      navigate('/app');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 24px',
      backgroundColor: 'var(--bg-color)',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(79, 70, 229, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.05) 0px, transparent 50%)'
    }}>
      <div style={{ width: '100%', maxWidth: '1100px' }}>
        <Button
          type="text"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate('/')}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: 0, 
            marginBottom: '32px', 
            color: 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          Back to Home
        </Button>

        <Row gutter={[40, 40]} align="stretch">
          {/* Left Column: Premium Web3 Role Selection Grid */}
          <Col xs={24} lg={13} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                background: 'linear-gradient(135deg, var(--primary-color) 0%, #6366F1 100%)',
                borderRadius: '10px',
                color: 'white',
                marginBottom: '20px',
                boxShadow: '0 8px 18px rgba(79, 70, 229, 0.2)'
              }}>
                <Layers size={20} />
              </div>
              <Title level={1} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '38px', letterSpacing: '-0.03em' }}>
                Select Your Web3 Role
              </Title>
              <Paragraph type="secondary" style={{ fontSize: '15px', marginTop: '8px', color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '32px' }}>
                Nexus accounts are multi-role by definition. Explore the specialized dashboards or connect a sandbox session tuned to your specific goals.
              </Paragraph>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Lender Card */}
                <div 
                  onClick={() => setSelectedRole('LENDER')}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-lg)',
                    border: selectedRole === 'LENDER' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    backgroundColor: selectedRole === 'LENDER' ? 'rgba(79, 70, 229, 0.02)' : 'var(--surface-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: selectedRole === 'LENDER' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}
                  className="role-card"
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(79, 70, 229, 0.08)',
                    color: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Coins size={20} />
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', color: 'var(--text-main)' }}>Lender / Yield Creator</Text>
                      {selectedRole === 'LENDER' && <Tag color="blue" style={{ border: 'none', borderRadius: '4px' }}>Selected Focus</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginTop: '4px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
                      Provide USDC liquidity, customize APR rates, grace periods, and earn compounding yields backed by isolated XLM smart escrows.
                    </Text>
                  </div>
                </div>

                {/* Borrower Card */}
                <div 
                  onClick={() => setSelectedRole('BORROWER')}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-lg)',
                    border: selectedRole === 'BORROWER' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    backgroundColor: selectedRole === 'BORROWER' ? 'rgba(79, 70, 229, 0.02)' : 'var(--surface-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: selectedRole === 'BORROWER' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}
                  className="role-card"
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(6, 182, 212, 0.08)',
                    color: 'var(--secondary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Zap size={20} />
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', color: 'var(--text-main)' }}>Borrower / Leverage Trader</Text>
                      {selectedRole === 'BORROWER' && <Tag color="cyan" style={{ border: 'none', borderRadius: '4px' }}>Selected Focus</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginTop: '4px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
                      Accept open marketplace terms, lock XLM collateral, and draw instant USDC. Repay anytime or top-up collateral to avoid liquidation.
                    </Text>
                  </div>
                </div>

                {/* Liquidator Card */}
                <div 
                  onClick={() => setSelectedRole('LIQUIDATOR')}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-lg)',
                    border: selectedRole === 'LIQUIDATOR' ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    backgroundColor: selectedRole === 'LIQUIDATOR' ? 'rgba(79, 70, 229, 0.02)' : 'var(--surface-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: selectedRole === 'LIQUIDATOR' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start'
                  }}
                  className="role-card"
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: 'var(--danger-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Gauge size={20} />
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong style={{ fontSize: '16px', fontFamily: 'var(--font-heading)', color: 'var(--text-main)' }}>Liquidator / Risk Arbitrageur</Text>
                      {selectedRole === 'LIQUIDATOR' && <Tag color="error" style={{ border: 'none', borderRadius: '4px' }}>Selected Focus</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginTop: '4px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
                      Scan the pool for loans with Health Factor &lt; 1.20 or past maturity. Repay debt to seize collateral at a premium.
                    </Text>
                  </div>
                </div>
              </div>
            </div>
          </Col>

          {/* Right Column: Wallet Connection Card */}
          <Col xs={24} lg={11} style={{ display: 'flex', alignItems: 'stretch' }}>
            <Card
              style={{
                width: '100%',
                boxShadow: 'var(--shadow-xl)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
              styles={{ body: { padding: '40px' } }}
            >
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '24px', letterSpacing: '-0.02em' }}>
                  Connect Wallet
                </Title>
                <Paragraph type="secondary" style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>
                  Use your Freighter wallet to access Stellar Testnet.
                </Paragraph>
              </div>

              <Space orientation="vertical" size="large" style={{ width: '100%' }}>
                {isAvailable === false && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Freighter is not installed"
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

                {/* Freighter Wrong Network Alert & Guidance */}
                {isConnected && !isTestnet && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Change Network Required"
                    description={
                      <div style={{ fontSize: '13px', marginTop: 4 }}>
                        <div style={{ marginBottom: 8 }}>
                          Your Freighter extension is connected to <Text strong>{network ?? 'Unknown Network'}</Text>, but Nexus runs on <Text strong>Stellar Testnet</Text>.
                        </div>
                        <div style={{ 
                          padding: '10px 12px', 
                          backgroundColor: 'rgba(245, 158, 11, 0.05)', 
                          border: '1px solid rgba(245, 158, 11, 0.2)',
                          borderRadius: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}>
                          <Text strong style={{ fontSize: '12px' }}>How to switch to Testnet:</Text>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '12px' }}>
                            <div>1. Open the <b>Freighter extension</b> popup.</div>
                            <div>2. Click the <b>Settings cog icon</b> in the top right.</div>
                            <div>3. Choose <b>Network</b> or <b>Preferences</b>.</div>
                            <div>4. Select <b>TESTNET</b> from the active list.</div>
                          </div>
                        </div>
                      </div>
                    }
                  />
                )}

                {/* Other Connection Errors */}
                {error && (!isConnected || isTestnet) && (
                  <Alert
                    type="error"
                    showIcon
                    message="Wallet Connection Error"
                    description={error}
                  />
                )}

                {isConnected && isTestnet && (
                  <Alert
                    type="success"
                    showIcon
                    message="Freighter Session Active"
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
                    <Text strong style={{ display: 'block', fontSize: '11px', color: 'var(--text-main)', letterSpacing: '0.05em' }}>WALLET PROVIDER</Text>
                    <Text type="secondary" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {isConnected ? 'Freighter Wallet' : 'No wallet connected'}
                    </Text>
                  </div>
                  <Tag color={isConnected ? (isTestnet ? 'success' : 'warning') : 'default'} style={{ border: 'none', margin: 0, fontWeight: 700 }}>
                    {isConnected ? (isTestnet ? 'Testnet Active' : 'Wrong Net') : 'Disconnected'}
                  </Tag>
                </div>

                <div style={{
                  padding: '14px 16px',
                  backgroundColor: 'rgba(16, 185, 129, 0.02)',
                  border: '1px solid rgba(16, 185, 129, 0.12)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <ShieldCheck size={16} style={{ color: 'var(--success-color)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <Text strong style={{ fontSize: '12px', display: 'block', color: 'var(--text-main)' }}>
                      Non-Custodial Escrow Security
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px', lineHeight: '1.4', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      Nexus uses secure Freighter signatures. Your private keys never leave your browser extension, ensuring full self-custody.
                    </Text>
                  </div>
                </div>

                <Space direction="vertical" size="small" style={{ width: '100%', marginTop: '8px' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<Wallet size={16} />}
                    onClick={isConnected ? handleLaunch : handleConnect}
                    loading={isLoading}
                    disabled={isAvailable === false}
                    style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {isConnected ? 'Enter Lending Dashboard' : 'Connect Wallet'}
                  </Button>

                  {(!isConnected || isAvailable === false) && (
                    <Button
                      type="default"
                      size="large"
                      onClick={() => handleConnectMock(selectedRole || undefined)}
                      style={{
                        width: '100%',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderColor: 'var(--primary-color)',
                        color: 'var(--primary-color)',
                        marginTop: '8px',
                        fontWeight: 600
                      }}
                    >
                      {selectedRole 
                        ? `Connect Mock ${selectedRole.charAt(0) + selectedRole.slice(1).toLowerCase()} Dashboard` 
                        : 'Connect Sandbox Wallet (Mock Mode)'}
                    </Button>
                  )}

                  {isConnected && (
                    <Button
                      size="large"
                      onClick={handleRefresh}
                      loading={isLoading}
                      icon={<RefreshCw size={14} />}
                      style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      Sync Wallet & Network
                    </Button>
                  )}
                </Space>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};
