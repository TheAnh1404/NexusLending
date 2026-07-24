import React, { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tag, Button, Dropdown, Popover, Badge } from 'antd';
import {
  ShoppingBag,
  Briefcase,
  PieChart,
  Settings as SettingsIcon,
  Wallet,
  ArrowRightLeft,
  Bell,
  LogOut,
  Copy,
  Check,
  X,
  Trash2,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
} from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';
import { useAppContext } from '../../app/AppContext';
import { NETWORK_DISPLAY_NAME } from '../../services/soroban/config';
import { filterWalletActivities } from '../../utils/activity';
import { isOpenLoanStatus } from '../../utils/finance';
import { getConnectedWalletAddress, isSameWalletAddress } from '../../utils/wallet';
import { AppLogo } from './AppLogo';

import type { Transaction } from '../../types';
import { NotificationDetailModal } from './NotificationDetailModal';

// Navigation Sidebar Configuration

const SIDEBAR_NAV_ITEMS = [
  { key: '/app/marketplace', label: 'Marketplace', icon: <ShoppingBag size={20} /> },
  { key: '/app/my-loans', label: 'My Loans', icon: <Briefcase size={20} /> },
  { key: '/app/portfolio', label: 'Portfolio', icon: <PieChart size={20} /> },
  { key: '/app/settings', label: 'Settings', icon: <SettingsIcon size={20} /> },
];

interface AppSidebarProps {
  onOpenSwap?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ onOpenSwap }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wallet, disconnectWallet, activities, loanOffers, loans, oraclePrices, dismissActivity, clearAllActivities } = useAppContext();
  const { isConnected, shortAddress, publicKey, disconnect } = useWallet();

  const [copied, setCopied] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Transaction | null>(null);

  const walletActivities = React.useMemo(
    () => filterWalletActivities(activities, publicKey ?? wallet.address, loans, loanOffers),
    [activities, loanOffers, loans, publicKey, wallet.address]
  );

  const userAddress = getConnectedWalletAddress(publicKey, wallet.address);

  // ── Compute Supply / Borrow / Health Factor ───────────────────────────
  const { totalSupply, totalBorrow, avgHealthFactor } = useMemo(() => {
    const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
    const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

    const getAssetPrice = (asset: string) =>
      asset === 'XLM' ? xlmPrice : asset === 'USDC' ? usdcPrice : 1.0;

    // Supply = loans where user is lender (active) + pending offers
    const activeLoansAsLender = loans.filter(
      (l) => isSameWalletAddress(l.lender, userAddress) && isOpenLoanStatus(l.status),
    );
    const activeOffersAsPending = loanOffers.filter(
      (o) => isSameWalletAddress(o.lender, userAddress) && o.status === 'Active',
    );
    const supply =
      activeLoansAsLender.reduce((sum, l) => sum + l.amount * getAssetPrice(l.asset), 0) +
      activeOffersAsPending.reduce((sum, o) => sum + o.amount * getAssetPrice(o.asset), 0);

    // Borrow = loans where user is borrower (active)
    const activeLoansAsBorrower = loans.filter(
      (l) => isSameWalletAddress(l.borrower, userAddress) && isOpenLoanStatus(l.status),
    );
    const borrow = activeLoansAsBorrower.reduce(
      (sum, l) => sum + l.outstandingDebt * getAssetPrice(l.asset), 0,
    );

    // HF = weighted average of per-loan healthFactor (weighted by debt in USD)
    // Each loan.healthFactor is already calculated correctly with liquidationThreshold
    let hf = 0;
    if (activeLoansAsBorrower.length > 0 && borrow > 0) {
      const weightedSum = activeLoansAsBorrower.reduce(
        (sum, l) => sum + l.healthFactor * (l.outstandingDebt * getAssetPrice(l.asset)),
        0,
      );
      hf = weightedSum / borrow;
    }

    return { totalSupply: supply, totalBorrow: borrow, avgHealthFactor: hf };
  }, [loans, loanOffers, oraclePrices, userAddress]);

  const getHfColor = (hf: number) => {
    if (hf <= 0) return 'var(--text-muted)';
    if (hf < 1.2) return '#ff4d4f';
    if (hf < 1.5) return '#fa8c16';
    return '#52c41a';
  };

  const getHfLabel = (hf: number) => {
    if (hf <= 0) return '—';
    return hf.toFixed(2);
  };

  const handleCopyAddress = () => {
    if (publicKey || wallet.address) {
      navigator.clipboard.writeText(publicKey || wallet.address || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    disconnectWallet();
    navigate('/connect');
  };

  const activeNavKey = SIDEBAR_NAV_ITEMS.find((item) => location.pathname.startsWith(item.key))?.key || '/app/marketplace';

  const walletMenu = {
    items: [
      {
        key: 'copy',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleCopyAddress}>
            {copied ? <Check size={14} style={{ color: 'var(--success-color)' }} /> : <Copy size={14} />}
            <span>Copy Address</span>
          </div>
        ),
      },
      {
        key: 'settings',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/app/settings')}>
            <SettingsIcon size={14} />
            <span>Settings</span>
          </div>
        ),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'disconnect',
        danger: true,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleDisconnect}>
            <LogOut size={14} />
            <span>Disconnect</span>
          </div>
        ),
      },
    ],
  };

  const notificationContent = (
    <div style={{ width: 300, maxHeight: 340, overflowY: 'auto' }}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid var(--border-light, #e5e7eb)',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 13 }}>Notifications ({walletActivities.length})</span>
        {walletActivities.length > 0 && (
          <Button
            type="text"
            danger
            size="small"
            icon={<Trash2 size={12} />}
            onClick={clearAllActivities}
            style={{ padding: '0 4px', height: 'auto', fontSize: 11, fontWeight: 600 }}
          >
            Clear All
          </Button>
        )}
      </div>
      {walletActivities.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No recent notifications
        </div>
      ) : (
        walletActivities.map((act) => (
          <div
            key={act.id}
            onClick={() => {
              setSelectedActivity(act);
              setNotificationOpen(false);
            }}
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-light, #f3f4f6)',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{act.type.replace(/_/g, ' ')}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.details}</div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<X size={14} style={{ color: 'var(--text-muted)' }} />}
              onClick={(e) => {
                e.stopPropagation();
                dismissActivity(act.id);
              }}
              style={{ padding: 2, height: 'auto', minWidth: 'auto' }}
            />
          </div>
        ))
      )}
    </div>
  );

  return (
    <aside
      className="desktop-sidebar"
      style={{
        width: '240px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--border-light, #e5e7eb)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
        padding: '24px 16px',
      }}
    >
      {/* Top: Logo & Main Vertical Menu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Logo synced with LandingPage */}
        <div style={{ paddingLeft: '4px' }}>
          <AppLogo size="medium" onClick={() => navigate('/app/marketplace')} />
        </div>

        {/* 4 Main Vertical Menu Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const isActive = activeNavKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isActive ? 'rgba(79, 70, 229, 0.09)' : 'transparent',
                  color: isActive ? 'var(--primary-color, #4f46e5)' : 'var(--text-secondary, #4b5563)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '15px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Financial Overview Widget ──────────────────────────────── */}
        {isConnected && (
          <div
            style={{
              borderRadius: 12,
              border: '1px solid var(--border-color, #e2e8f0)',
              background: 'linear-gradient(145deg, rgba(248,250,252,0.95) 0%, rgba(241,245,249,0.95) 100%)',
              padding: '14px 14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              Account Overview
            </div>

            {/* Your Supply */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: 'rgba(82, 196, 26, 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={14} style={{ color: '#52c41a' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Supply</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#52c41a', fontFamily: 'monospace' }}>
                {totalSupply > 0 ? `$${totalSupply.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
              </span>
            </div>

            {/* Your Borrow */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: 'rgba(79, 70, 229, 0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingDown size={14} style={{ color: '#4f46e5' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Borrow</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#4f46e5', fontFamily: 'monospace' }}>
                {totalBorrow > 0 ? `$${totalBorrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
              </span>
            </div>

            {/* Divider */}
            <div style={{ height: 1, backgroundColor: 'var(--border-color, #e2e8f0)' }} />

            {/* Health Factor */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    backgroundColor: `${getHfColor(avgHealthFactor)}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={14} style={{ color: getHfColor(avgHealthFactor) }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Health</span>
              </div>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: getHfColor(avgHealthFactor),
                  fontFamily: 'monospace',
                }}
              >
                {getHfLabel(avgHealthFactor)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Network, Notifications, Swap & Wallet Summary */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
        {onOpenSwap && (
          <Button
            type="default"
            icon={<ArrowRightLeft size={16} />}
            onClick={onOpenSwap}
            block
            style={{ borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            Swap Assets
          </Button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <Tag color="blue" style={{ borderRadius: 4, margin: 0, fontWeight: 600, fontSize: 11 }}>
            {NETWORK_DISPLAY_NAME}
          </Tag>

          <Popover
            content={notificationContent}
            trigger="click"
            open={notificationOpen}
            onOpenChange={setNotificationOpen}
            placement="topRight"
          >
            <Button
              type="text"
              size="small"
              icon={
                <Badge count={walletActivities.length} size="small">
                  <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
                </Badge>
              }
            />
          </Popover>
        </div>

        {isConnected ? (
          <Dropdown menu={walletMenu} trigger={['click']} placement="topCenter">
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                borderRadius: 8,
                border: '1px solid var(--border-light, #e2e8f0)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Wallet size={16} style={{ color: 'var(--primary-color)' }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>Connected</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{shortAddress}</div>
              </div>
            </div>
          </Dropdown>
        ) : (
          <Button type="primary" block onClick={() => navigate('/connect')} style={{ borderRadius: 8, fontWeight: 600 }}>
            Connect Wallet
          </Button>
        )}
      </div>

      <NotificationDetailModal
        open={!!selectedActivity}
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onDismiss={dismissActivity}
        onViewLoan={() => navigate('/app/my-loans')}
      />
    </aside>
  );
};
