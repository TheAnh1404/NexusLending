import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { Layers, ArrowRight } from 'lucide-react';
import { Button, Layout, Space, Tag } from 'antd';

const { Header, Content, Footer } = Layout;

export const PublicLayout: React.FC = () => {
  const { isConnected, shortAddress, isTestnet, network } = useWallet();
  const navigate = useNavigate();

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC' }}>
      {/* Top Header */}
      <Header
        className="glass-header public-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          height: '70px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: 'var(--primary-color)',
              borderRadius: '8px',
              color: 'white',
              boxShadow: '0 4px 10px rgba(47, 128, 237, 0.25)'
            }}>
              <Layers size={18} />
            </div>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              display: 'inline-flex',
              alignItems: 'center',
            }}>
              NEXUS
            </span>
          </Link>
          <nav className="hide-mobile" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <a href="#problem" style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>Problem</a>
            <a href="#solution" style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>Solution</a>
            <a href="#features" style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>Features</a>
            <a href="#how-it-works" style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>Process</a>
          </nav>
        </div>

        <div className="public-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isConnected ? (
            <Space size="middle">
              <Tag color={isTestnet ? 'blue' : 'warning'} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', padding: '4px 12px' }}>
                {isTestnet ? 'Stellar Testnet' : network ?? 'Wrong Network'}
              </Tag>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Freighter connected</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                  {shortAddress}
                </span>
              </div>
              <Button type="primary" onClick={() => navigate('/app')}>
                Launch Dashboard <ArrowRight size={14} style={{ marginLeft: 6 }} />
              </Button>
            </Space>
          ) : (
            <Button type="primary" size="large" onClick={() => navigate('/connect')}>
              Launch App
            </Button>
          )}
        </div>
      </Header>

      {/* Page Content */}
      <Content style={{ flex: 1 }}>
        <Outlet />
      </Content>

      {/* Footer */}
      <Footer style={{
        textAlign: 'center',
        padding: '40px 0',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid var(--border-color)',
        color: 'var(--text-muted)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: 'var(--primary-color)' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--text-main)' }}>NEXUS LENDING</span>
          </div>
          <span style={{ fontSize: '14px' }}>
            Copyright {new Date().getFullYear()} Nexus Lending Protocol. Built for Stellar Soroban Smart Contracts.
          </span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a href="https://github.com" target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
            </a>
          </div>
        </div>
      </Footer>
    </Layout>
  );
};
