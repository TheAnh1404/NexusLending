import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Briefcase, PieChart, Settings as SettingsIcon } from 'lucide-react';

const MOBILE_NAV_ITEMS = [
  { key: '/app/marketplace', label: 'Marketplace', icon: <ShoppingBag size={18} /> },
  { key: '/app/my-loans', label: 'My Loans', icon: <Briefcase size={18} /> },
  { key: '/app/portfolio', label: 'Portfolio', icon: <PieChart size={18} /> },
  { key: '/app/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
];

export const MobileBottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeNavKey = MOBILE_NAV_ITEMS.find((item) => location.pathname.startsWith(item.key))?.key || '/app/marketplace';

  return (
    <div
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid var(--border-light, #e5e7eb)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
      }}
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive = activeNavKey === item.key;
        return (
          <button
            key={item.key}
            onClick={() => navigate(item.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2px',
              flex: 1,
              height: '100%',
              background: 'none',
              border: 'none',
              color: isActive ? 'var(--primary-color, #4f46e5)' : 'var(--text-muted, #6b7280)',
              fontWeight: isActive ? 600 : 500,
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
