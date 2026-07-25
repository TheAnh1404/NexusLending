import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, Popover, Dropdown } from 'antd';
import {
  LogOut,
  Bell,
  Coins,
  Copy,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import { useWallet } from '../../hooks/useWallet';
import { useAppContext } from '../../app/AppContext';
import { filterWalletActivities } from '../../utils/activity';
import { AppLogo } from './AppLogo';
import { NotificationDetailModal } from './NotificationDetailModal';
import type { Transaction } from '../../types';

// Mobile App Header Component

export const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const { wallet, disconnectWallet, activities, loanOffers, loans, dismissActivity, clearAllActivities } = useAppContext();
  const { isConnected, shortAddress, publicKey, disconnect } = useWallet();

  const [notificationOpen, setNotificationOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Transaction | null>(null);

  const walletActivities = React.useMemo(
    () => filterWalletActivities(activities, publicKey ?? wallet.address, loans, loanOffers),
    [activities, loanOffers, loans, publicKey, wallet.address]
  );

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

  const walletMenu = {
    items: [
      {
        key: 'faucet',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/faucet')}>
            <Coins size={14} style={{ color: 'var(--primary-color)' }} />
            <span style={{ fontWeight: 600 }}>Testnet Faucet</span>
          </div>
        ),
      },
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
    <div style={{ width: 280, maxHeight: 320, overflowY: 'auto' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light, #e5e7eb)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Notifications ({walletActivities.length})</span>
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
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
    <>
      {/* Mobile Top Header Only (<768px), hidden on desktop */}
      <header
        className="mobile-header-only"
        style={{
          height: '60px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid var(--border-light, #e5e7eb)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <AppLogo size="small" onClick={() => navigate('/app/marketplace')} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            type="default"
            size="small"
            icon={<Coins size={14} style={{ color: 'var(--primary-color)' }} />}
            onClick={() => navigate('/faucet')}
            style={{ fontWeight: 600, borderRadius: 6, fontSize: 11 }}
          >
            Faucet
          </Button>

          <Popover
            content={notificationContent}
            trigger="click"
            open={notificationOpen}
            onOpenChange={setNotificationOpen}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={
                <Badge count={walletActivities.length} size="small">
                  <Bell size={16} />
                </Badge>
              }
            />
          </Popover>

          {isConnected ? (
            <Dropdown menu={walletMenu} trigger={['click']} placement="bottomRight">
              <Button type="primary" size="small" style={{ fontWeight: 600, borderRadius: 6 }}>
                {shortAddress}
              </Button>
            </Dropdown>
          ) : (
            <Button type="primary" size="small" onClick={() => navigate('/connect')} style={{ borderRadius: 6 }}>
              Connect
            </Button>
          )}
        </div>
      </header>

      <NotificationDetailModal
        open={!!selectedActivity}
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onDismiss={dismissActivity}
        onViewLoan={() => navigate('/app/my-loans')}
      />
    </>
  );
};

