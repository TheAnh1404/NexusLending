import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { SwapModal } from '../components/common/SwapModal';
import { isAdminWallet } from '../config/admin';
import { filterWalletActivities } from '../utils/activity';
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
  Descriptions,
  Modal,
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
  ShieldCheck,
} from 'lucide-react';
import type { Transaction } from '../types';

const { Header, Content, Sider } = AntLayout;
const { Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const formatActivityType = (type: string): string => type.replace(/_/g, ' ');

const formatActivityTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
};

const shortValue = (value?: string): string => {
  if (!value) return '-';
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
};

export const AppLayout: React.FC = () => {
  const { wallet, disconnectWallet, activities, loanOffers, loans, connectWallet } = useAppContext();
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
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Transaction | null>(null);
  const isAdmin = isAdminWallet(publicKey ?? wallet.address);
  const notificationActivities = React.useMemo(
    () => filterWalletActivities(activities, publicKey ?? wallet.address, loans, loanOffers),
    [activities, loanOffers, loans, publicKey, wallet.address]
  );

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

  // Redirect admin from /app index to /app/admin
  React.useEffect(() => {
    if (!isLoading && isConnected && isAdmin && location.pathname === '/app') {
      navigate('/app/admin', { replace: true });
    }
  }, [isAdmin, isConnected, isLoading, location.pathname, navigate]);

  const menuItems = isAdmin
    ? [
        {
          key: '/app/admin',
          icon: <ShieldCheck size={16} />,
          label: 'Admin Console',
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
      ]
    : [
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
          key: '/app/settings',
          icon: <SettingsIcon size={16} />,
          label: 'Profile & Settings',
        },
      ];

  const selectedMenuKey =
    menuItems
      .map((item) => item.key)
      .filter((key) => location.pathname === key || location.pathname.startsWith(`${key}/`))
      .sort((a, b) => b.length - a.length)[0] || (isAdmin ? '/app/admin' : '/app');

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    disconnect();
    disconnectWallet();
    navigate('/connect');
  };

  const openNotificationDetail = (activity: Transaction) => {
    setSelectedNotification(activity);
    setNotificationOpen(false);
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

  // Render recent 5 wallet-scoped logs as notifications
  const notificationContent = (
    <div style={{ width: '320px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        <Text strong>Wallet Activities</Text>
        <Badge status="processing" text="Live Syncing" />
      </div>
      {notificationActivities.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          No wallet-specific events.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notificationActivities.slice(0, 5).map((item, idx) => (
            <div
              key={item.id || idx}
              role="button"
              tabIndex={0}
              onClick={() => openNotificationDetail(item)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openNotificationDetail(item);
                }
              }}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
                borderBottom: idx < 4 ? '1px solid var(--border-color)' : 'none',
              }}
            >
              <div style={{ marginTop: '3px' }}>
                <Activity size={14} style={{ color: 'var(--primary-color)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: '11px' }}>
                    {formatActivityType(item.type)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '9px' }}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                  {item.details}
                </div>
                <Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: '11px' }}>
                  View details
                </Button>
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
                  {isAdmin ? 'Admin' : 'Multi-role'}
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
                {!isAdmin && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px', marginBottom: '6px' }}>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, height: 'auto', fontSize: '11px', color: 'var(--primary-color)' }}
                        onClick={() => setSwapModalOpen(true)}
                      >
                        Swap XLM to USDC
                      </Button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '4px', marginTop: '4px', fontSize: '10px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Lending: {lenderLoansCount} | Borrowing: {borrowerLoansCount}</span>
                    </div>
                  </>
                )}
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
            {isAdmin && (
              <Tag color="purple" style={{ display: 'inline-flex', alignItems: 'center', border: 'none', padding: '3px 10px', fontSize: '11px', margin: 0 }}>
                <ShieldCheck size={12} style={{ marginRight: '6px' }} />
                Admin
              </Tag>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Live Health Factor Summary */}
            {!isAdmin && hasLoans && avgHF && (
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
            <Popover
              content={notificationContent}
              title="Wallet Alerts"
              trigger="click"
              placement="bottomRight"
              open={notificationOpen}
              onOpenChange={setNotificationOpen}
            >
              <Button
                type="text"
                shape="circle"
                icon={
                  <Badge count={notificationActivities.length} size="small" offset={[-2, 2]}>
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
      <SwapModal open={swapModalOpen} onCancel={() => setSwapModalOpen(false)} />
      <Modal
        open={!!selectedNotification}
        title={selectedNotification ? formatActivityType(selectedNotification.type) : 'Notification Detail'}
        onCancel={() => setSelectedNotification(null)}
        footer={[
          selectedNotification?.explorerUrl ? (
            <Button key="explorer" type="default" href={selectedNotification.explorerUrl} target="_blank">
              Open Explorer
            </Button>
          ) : null,
          <Button key="close" type="primary" onClick={() => setSelectedNotification(null)}>
            Close
          </Button>,
        ]}
        width={620}
        destroyOnHidden
      >
        {selectedNotification && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Paragraph style={{ margin: 0 }}>
              {selectedNotification.details}
            </Paragraph>
            <Descriptions
              bordered
              column={1}
              size="small"
              items={[
                {
                  key: 'time',
                  label: 'Time',
                  children: formatActivityTime(selectedNotification.timestamp),
                },
                {
                  key: 'status',
                  label: 'Status',
                  children: selectedNotification.status ?? 'Recorded',
                },
                {
                  key: 'wallet',
                  label: 'Wallet',
                  children: (
                    <Text copyable={{ text: selectedNotification.user }} style={{ fontFamily: 'var(--font-mono)' }}>
                      {shortValue(selectedNotification.user)}
                    </Text>
                  ),
                },
                {
                  key: 'amount',
                  label: 'Amount',
                  children: `${selectedNotification.amount.toLocaleString()} ${selectedNotification.asset}`,
                },
                {
                  key: 'loanId',
                  label: 'Loan ID',
                  children: selectedNotification.loanId ? (
                    <Text copyable={{ text: selectedNotification.loanId }} style={{ fontFamily: 'var(--font-mono)' }}>
                      {selectedNotification.loanId}
                    </Text>
                  ) : '-',
                },
                {
                  key: 'offerId',
                  label: 'Offer ID',
                  children: selectedNotification.offerId ? (
                    <Text copyable={{ text: selectedNotification.offerId }} style={{ fontFamily: 'var(--font-mono)' }}>
                      {selectedNotification.offerId}
                    </Text>
                  ) : '-',
                },
                {
                  key: 'txHash',
                  label: 'Transaction Hash',
                  children: selectedNotification.txHash ? (
                    <Text copyable={{ text: selectedNotification.txHash }} style={{ fontFamily: 'var(--font-mono)' }}>
                      {shortValue(selectedNotification.txHash)}
                    </Text>
                  ) : '-',
                },
                {
                  key: 'ledger',
                  label: 'Ledger',
                  children: selectedNotification.ledger ? `#${selectedNotification.ledger}` : '-',
                },
                {
                  key: 'contract',
                  label: 'Contract',
                  children: selectedNotification.contract ? (
                    <Text copyable={{ text: selectedNotification.contract }} style={{ fontFamily: 'var(--font-mono)' }}>
                      {shortValue(selectedNotification.contract)}
                    </Text>
                  ) : '-',
                },
                {
                  key: 'blockTimestamp',
                  label: 'Block Time',
                  children: selectedNotification.blockTimestamp ? formatActivityTime(selectedNotification.blockTimestamp) : '-',
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </AntLayout>
  );
};
