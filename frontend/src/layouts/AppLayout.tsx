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
  List,
  Tag,
  Typography,
  Grid,
  Alert,
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
} from 'lucide-react';

const { Header, Content, Sider } = AntLayout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

export const AppLayout: React.FC = () => {
  const { wallet, disconnectWallet, activities } = useAppContext();
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

  // If wallet is not connected, redirect to /connect
  React.useEffect(() => {
    if (!isLoading && !isConnected) {
      navigate('/connect');
    }
  }, [isConnected, isLoading, navigate]);

  const menuItems = [
    {
      key: '/app',
      icon: <LayoutDashboard size={18} />,
      label: 'Dashboard',
    },
    {
      key: '/app/marketplace',
      icon: <ShoppingBag size={18} />,
      label: 'Marketplace',
    },
    {
      key: '/app/create-loan',
      icon: <PlusCircle size={18} />,
      label: 'Create Loan Offer',
    },
    {
      key: '/app/my-loans',
      icon: <FileText size={18} />,
      label: 'My Loans',
    },
    {
      key: '/app/borrower',
      icon: <UserCheck size={18} />,
      label: 'Borrower Dashboard',
    },
    {
      key: '/app/lender',
      icon: <Percent size={18} />,
      label: 'Lender Dashboard',
    },
    {
      key: '/app/liquidation',
      icon: <Flame size={18} />,
      label: 'Liquidation Center',
    },
    {
      key: '/app/oracle',
      icon: <LineChart size={18} />,
      label: 'Oracle Monitor',
    },
    {
      key: '/app/settings',
      icon: <SettingsIcon size={18} />,
      label: 'Settings',
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

  // Render recent 5 logs as notifications
  const notificationContent = (
    <div style={{ width: '320px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Text strong>Recent Notifications</Text>
        <Badge status="processing" text="Live" />
      </div>
      {activities.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          No new alerts
        </div>
      ) : (
        <List
          dataSource={activities.slice(0, 5)}
          renderItem={(item) => (
            <List.Item style={{ padding: '8px 0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ marginTop: '3px' }}>
                <Activity size={14} style={{ color: 'var(--primary-color)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: '12px' }}>
                    {item.type.replace(/_/g, ' ')}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '10px' }}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                  {item.details}
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

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
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '24px 20px',
          height: '70px',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          width: '32px',
          height: '32px',
            background: 'var(--primary-color)',
            borderRadius: '6px',
            color: 'white',
            flexShrink: 0
          }}>
            <Layers size={16} />
          </div>
          {!collapsed && (
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
            }}>
              Nexus Protocol
            </span>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ marginTop: '16px' }}
        />

        {!collapsed && (
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '20px',
            right: '20px',
            padding: '16px',
            background: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>DEMO BALANCES</span>
              <Tag color={wallet.role === 'LENDER' ? 'green' : wallet.role === 'BORROWER' ? 'blue' : 'volcano'} style={{ border: 'none', margin: 0, fontSize: '10px' }}>
                {wallet.role ?? 'ROLE'}
              </Tag>
            </div>
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              wordBreak: 'break-all'
            }}>
              {shortAddress || 'Not connected'}
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>USDC:</span>
                <span style={{ fontWeight: 500 }}>${wallet.balanceUSDC.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>XLM:</span>
                <span style={{ fontWeight: 500 }}>{wallet.balanceXLM.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="nexus-logo-mark">
                <Layers size={17} />
              </span>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, lineHeight: 1.1 }}>
                  Nexus Lending
                </div>
                <div className="hide-mobile" style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.1 }}>
                  P2P collateral markets
                </div>
              </div>
            </div>
            <Tag color={isTestnet ? 'geekblue' : 'warning'} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', padding: '4px 12px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: isTestnet ? '#2F80ED' : '#F2994A', borderRadius: '50%', marginRight: '4px' }}></span>
              {isTestnet ? 'Stellar Testnet' : network ?? 'Wrong Network'}
            </Tag>
            <div className="hide-mobile" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Contract Mode: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Soroban P2P Multi-collateral v1</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Notification Bell */}
            <Popover content={notificationContent} title="Alerts & Notifications" trigger="click" placement="bottomRight">
              <Button
                type="text"
                shape="circle"
                icon={
                  <Badge count={activities.length > 0 ? Math.min(activities.length, 9) : 0} size="small">
                    <Bell size={20} style={{ color: 'var(--text-muted)' }} />
                  </Badge>
                }
              />
            </Popover>

            {/* User Wallet Tag */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'var(--bg-color)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)'
            }} className="hide-mobile">
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#27AE60' }}></div>
              <span style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                {shortAddress || 'Not connected'}
              </span>
            </div>

            {/* Logout Button */}
            <Button
              type="text"
              danger
              icon={<LogOut size={16} />}
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
              message="Freighter is not on Stellar Testnet"
              description="Switch Freighter to Stellar Testnet before signing real Nexus transactions."
              style={{ marginBottom: 24 }}
            />
          )}
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};
