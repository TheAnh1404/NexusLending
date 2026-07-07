import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import {
  Layout as AntLayout,
  Menu,
  Button,
  Badge,
  Popover,
  Tag,
  Typography,
  Grid,
  Alert,
  Breadcrumb,
} from 'antd';
import {
  LayoutDashboard,
  ShoppingBag,
  PlusCircle,
  FileText,
  UserCheck,
  Percent,
  Flame,
  LineChart,
  Settings as SettingsIcon,
  LogOut,
  Bell,
  Layers,
  Activity,
  Heart,
  ChevronRight,
} from 'lucide-react';

const { Header, Content, Sider } = AntLayout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

export const AppLayout: React.FC = () => {
  const { wallet, disconnectWallet, activities, loans, connectWallet } = useAppContext();
  const {
    isConnected,
    isLoading,
    publicKey,
    shortAddress,
    network,
    isTestnet,
    disconnect,
  } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isDesktop = !!screens.lg;
  const [collapsed, setCollapsed] = useState(false);

  // Sync WalletContext (Freighter connection) with LendingContext (lending state)
  React.useEffect(() => {
    if (isConnected && publicKey && !wallet.connected) {
      connectWallet(publicKey);
    }
  }, [isConnected, publicKey, wallet.connected, connectWallet]);

  // If wallet is not connected, redirect to /connect
  React.useEffect(() => {
    if (!isLoading && !isConnected) {
      navigate('/connect');
    }
  }, [isConnected, isLoading, navigate]);

  const menuItems = [
    {
      key: '/app',
      icon: <LayoutDashboard size={16} />,
      label: 'Dashboard',
    },
    {
      key: '/app/marketplace',
      icon: <ShoppingBag size={16} />,
      label: 'Marketplace',
    },
    {
      key: '/app/create-loan',
      icon: <PlusCircle size={16} />,
      label: 'Create Loan Offer',
    },
    {
      key: '/app/my-loans',
      icon: <FileText size={16} />,
      label: 'My Loans',
    },
    {
      key: '/app/borrower',
      icon: <UserCheck size={16} />,
      label: 'Borrower',
    },
    {
      key: '/app/lender',
      icon: <Percent size={16} />,
      label: 'Lender Portfolio',
    },
    {
      key: '/app/liquidation',
      icon: <Flame size={16} />,
      label: 'Liquidation Center',
    },
    {
      key: '/app/oracle',
      icon: <LineChart size={16} />,
      label: 'Oracle Monitor',
    },
    {
      key: '/app/settings',
      icon: <SettingsIcon size={16} />,
      label: 'System Status',
    },
  ];

  const selectedMenuKey =
    menuItems
      .map((item) => item.key)
      .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] || '/app';

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    disconnect();
    disconnectWallet();
    navigate('/connect');
  };

  // Dynamic breadcrumb labels
  const pathSnippets = location.pathname.split('/').filter((i) => i);
  const breadcrumbItems = pathSnippets.map((snippet, index) => {
    const url = `/${pathSnippets.slice(0, index + 1).join('/')}`;
    const label = snippet.charAt(0).toUpperCase() + snippet.slice(1).replace(/-/g, ' ');
    return {
      key: url,
      title: label === 'App' ? 'Nexus' : label,
    };
  });

  // Calculate user's aggregate Health Factor
  const activeUserLoans = loans.filter(
    (l) => l.borrower === wallet.address && ['Active', 'Warning', 'LiquidationPlanning'].includes(l.status)
  );
  const hasLoans = activeUserLoans.length > 0;
  const avgHF = hasLoans
    ? activeUserLoans.reduce((sum, l) => sum + l.healthFactor, 0) / activeUserLoans.length
    : null;

  const hfStatusColor = !avgHF
    ? 'default'
    : avgHF >= 1.4
    ? 'success'
    : avgHF >= 1.2
    ? 'warning'
    : 'error';

  const hfStatusText = !avgHF
    ? 'No Active Loans'
    : avgHF >= 1.4
    ? 'Healthy'
    : avgHF >= 1.2
    ? 'Warning'
    : 'Liquidation Risk';

  // Render recent 5 logs as notifications
  const notificationContent = (
    <div style={{ width: '320px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Text strong>System Activities</Text>
        <Badge status="processing" text="Live Syncing" />
      </div>
      {activities.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          No recent events.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activities.slice(0, 5).map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingBottom: '8px', borderBottom: idx < 4 ? '1px solid var(--border-color)' : 'none' }}>
              <div style={{ marginTop: '3px' }}>
                <Activity size={14} style={{ color: 'var(--primary-color)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: '11px' }}>
                    {item.type.replace(/_/g, ' ')}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '9px' }}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                  {item.details}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Calculate active loans where user is lender or borrower
  const lenderLoansCount = loans.filter((l) => l.lender === wallet.address && ['Active', 'Warning', 'PendingCollateral'].includes(l.status)).length;
  const borrowerLoansCount = loans.filter((l) => l.borrower === wallet.address && ['Active', 'Warning', 'PendingCollateral'].includes(l.status)).length;

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* Sidebar Sider */}
      <Sider
        collapsible
        collapsed={collapsed}
        collapsedWidth={isDesktop ? 80 : 0}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
        onCollapse={(value) => setCollapsed(value)}
        width={260}
        style={{
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1001,
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '24px 20px',
            height: '70px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              background: 'linear-gradient(135deg, var(--primary-color) 0%, #6366F1 100%)',
              borderRadius: '8px',
              color: 'white',
              flexShrink: 0
            }}>
              <Layers size={18} />
            </div>
            {!collapsed && (
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-main)',
                letterSpacing: '-0.03em',
              }}>
                Nexus Protocol
              </span>
            )}
          </div>
 
          {/* Menu - scrollable */}
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '24px' }}>
            <Menu
              mode="inline"
              selectedKeys={[selectedMenuKey]}
              items={menuItems}
              onClick={handleMenuClick}
              style={{ borderRight: 0 }}
            />
          </div>
 
          {/* Wallet Overview at bottom */}
          {!collapsed && (
            <div style={{
              padding: '16px',
              margin: '16px',
              background: 'var(--border-light)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>WALLET OVERVIEW</span>
                <Tag color="blue" style={{ border: 'none', margin: 0, fontSize: '9px', fontWeight: 700 }}>
                  Multi-role
                </Tag>
              </div>
              <div style={{
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-all',
                color: 'var(--text-main)'
              }}>
                {shortAddress || 'Not connected'}
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '2px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>USDC Balance:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>${wallet.balanceUSDC.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>XLM Balance:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{wallet.balanceXLM.toLocaleString()} XLM</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '4px', marginTop: '4px', fontSize: '10px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Lending: {lenderLoansCount} | Borrowing: {borrowerLoansCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Sider>

      {/* Main Layout Area */}
      <AntLayout style={{ marginLeft: isDesktop ? (collapsed ? 80 : 260) : 0, transition: 'margin-left 0.2s' }}>
        {/* Top Header */}
        <Header
          className="glass-header app-header"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            width: '100%',
            height: '70px',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Breadcrumb + Path */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Breadcrumb
              items={breadcrumbItems}
              separator={<ChevronRight size={12} style={{ color: 'var(--text-muted)', verticalAlign: 'middle' }} />}
              style={{ fontSize: '13px', fontWeight: 500 }}
            />
            
            <Tag color={isTestnet ? 'geekblue' : 'warning'} style={{ display: 'inline-flex', alignItems: 'center', border: 'none', padding: '3px 10px', fontSize: '11px', margin: 0 }}>
              <span style={{ display: 'inline-block', width: '5px', height: '5px', backgroundColor: isTestnet ? '#4F46E5' : '#F59E0B', borderRadius: '50%', marginRight: '6px' }}></span>
              {isTestnet ? 'Testnet' : network ?? 'Unknown Network'}
            </Tag>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Live Health Factor Summary */}
            {hasLoans && avgHF && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'var(--border-light)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)'
              }} className="hide-mobile">
                <Heart size={14} className="pulse-animation" style={{ color: avgHF >= 1.4 ? 'var(--success-color)' : 'var(--warning-color)' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Avg Health:</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: avgHF >= 1.4 ? 'var(--success-color)' : avgHF >= 1.2 ? 'var(--warning-color)' : 'var(--danger-color)' }}>
                  {avgHF.toFixed(2)}
                </span>
                <Tag color={hfStatusColor} style={{ border: 'none', margin: 0, fontSize: '9px', padding: '1px 6px' }}>
                  {hfStatusText}
                </Tag>
              </div>
            )}

            {/* Notification Bell */}
            <Popover content={notificationContent} title="System Alerts" trigger="click" placement="bottomRight">
              <Button
                type="text"
                shape="circle"
                icon={
                  <Badge count={activities.length} size="small" offset={[-2, 2]}>
                    <Bell size={18} style={{ color: 'var(--text-muted)' }} />
                  </Badge>
                }
              />
            </Popover>

            {/* Logout Button */}
            <Button
              type="default"
              icon={<LogOut size={14} />}
              onClick={handleLogout}
              style={{ fontSize: '13px' }}
            >
              Disconnect
            </Button>
          </div>
        </Header>

        {/* Dashboard Content Container */}
        <Content className="app-content" style={{ padding: '32px 40px', minHeight: 'calc(100vh - 70px)', overflowY: 'auto' }}>
          {!isTestnet && publicKey && (
            <Alert
              type="warning"
              showIcon
              message="Freighter connection issue"
              description="Freighter must be configured for Stellar Testnet to interact with contracts."
              style={{ marginBottom: 24 }}
            />
          )}
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
};
