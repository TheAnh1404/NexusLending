import React, { useEffect, useState } from 'react';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { formatCurrency } from '../utils/finance';
import { Card, Row, Col, Descriptions, Button, Switch, List, Typography, Tag, Space, message } from 'antd';
import { Wallet, ShieldCheck, Bell, Activity, Globe, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;
const NOTIFICATION_SETTINGS_KEY = 'nexus_notification_settings';

export const SettingsPage: React.FC = () => {
  const { wallet, activities, disconnectWallet } = useAppContext();
  const { publicKey, network, isTestnet, disconnect } = useWallet();
  const navigate = useNavigate();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [telegramAlerts, setTelegramAlerts] = useState(false);
  const [liqAlerts, setLiqAlerts] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<{
        emailAlerts: boolean;
        telegramAlerts: boolean;
        liqAlerts: boolean;
      }>;
      setEmailAlerts(parsed.emailAlerts ?? true);
      setTelegramAlerts(parsed.telegramAlerts ?? false);
      setLiqAlerts(parsed.liqAlerts ?? true);
    } catch {
      message.warning('Unable to load notification settings.');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify({
      emailAlerts,
      telegramAlerts,
      liqAlerts,
    }));
  }, [emailAlerts, liqAlerts, telegramAlerts]);

  const handleDisconnect = () => {
    disconnect();
    disconnectWallet();
    navigate('/connect');
  };

  const handleToggle = (setting: string, _val: boolean) => {
    message.success(`${setting} updated successfully.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div>
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
          Profile & Settings
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Manage your connected Stellar wallet details, RPC node preferences, and notifications.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left side: Wallet & Node Info */}
        <Col xs={24} lg={14}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Wallet details */}
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={16} style={{ color: 'var(--primary-color)' }} />
                  <span>Wallet Specifications</span>
                </div>
              }
              styles={{ body: { padding: '24px' } }}
            >
              <Descriptions bordered column={1} size="small" labelStyle={{ fontWeight: 600, width: '180px' }}>
                <Descriptions.Item label="Stellar Public Key">
                  <Text style={{ fontFamily: 'var(--font-mono)' }}>{publicKey ?? wallet.address}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Wallet Role">
                  <Tag color={wallet.role === 'LENDER' ? 'green' : wallet.role === 'BORROWER' ? 'blue' : 'volcano'}>
                    {wallet.role}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="USDC Balance">
                  <Text strong>{formatCurrency(wallet.balanceUSDC, 'USDC')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="XLM Balance">
                  <Text strong>{formatCurrency(wallet.balanceXLM, 'XLM')}</Text>
                </Descriptions.Item>
              </Descriptions>

              <Button
                type="primary"
                danger
                onClick={handleDisconnect}
                icon={<LogOut size={16} />}
                style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Disconnect Wallet
              </Button>
            </Card>

            {/* Network specs */}
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={16} style={{ color: 'var(--primary-color)' }} />
                  <span>Stellar Network & Node Status</span>
                </div>
              }
              styles={{ body: { padding: '24px' } }}
            >
              <Descriptions bordered column={1} size="small" labelStyle={{ fontWeight: 600, width: '180px' }}>
                <Descriptions.Item label="Selected Network">
                  <Tag color={isTestnet ? 'purple' : 'warning'}>{network ?? 'Unknown Network'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Horizon RPC URL">
                  <Text style={{ fontFamily: 'var(--font-mono)' }}>https://horizon-testnet.stellar.org</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Soroban RPC URL">
                  <Text style={{ fontFamily: 'var(--font-mono)' }}>https://soroban-testnet.stellar.org</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Node Status">
                  <Tag color="success">ONLINE & ACTIVE</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Stellar Core Version">
                  <Text>v21.1.0-rc1</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        </Col>

        {/* Right side: Alerts & History */}
        <Col xs={24} lg={10}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Notification settings */}
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} style={{ color: 'var(--primary-color)' }} />
                  <span>Risk Alerts & Notifications</span>
                </div>
              }
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ display: 'block' }}>Email Risk Alerts</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Receive alerts when Health Factor &lt; 1.4.</Text>
                  </div>
                  <Switch checked={emailAlerts} onChange={(val) => { setEmailAlerts(val); handleToggle('Email alerts', val); }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ display: 'block' }}>Telegram Instant Bot Notifications</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Direct message on margin warning thresholds.</Text>
                  </div>
                  <Switch checked={telegramAlerts} onChange={(val) => { setTelegramAlerts(val); handleToggle('Telegram alerts', val); }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ display: 'block' }}>Liquidation Warnings</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Immediate notification if a position drops below 1.2 HF.</Text>
                  </div>
                  <Switch checked={liqAlerts} onChange={(val) => { setLiqAlerts(val); handleToggle('Liquidation alerts', val); }} />
                </div>
              </div>
            </Card>

            {/* Smart Contract addresses */}
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} style={{ color: 'var(--primary-color)' }} />
                  <span>Soroban Smart Contract Addresses</span>
                </div>
              }
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                    NEXUS CORE ROUTER WASM
                  </Text>
                  <Text copyable style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    CDD6...93AE
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                    ESCROW FACTORY CONTRACT
                  </Text>
                  <Text copyable style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    CAS7...110B
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                    XLM COLLATERAL TOKEN
                  </Text>
                  <Text copyable style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    CDXLM...TESTNET
                  </Text>
                </div>
              </div>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* Transaction ledger history */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--primary-color)' }} />
            <span>Transaction Ledger History</span>
          </div>
        }
        styles={{ body: { padding: '0px' } }}
      >
        <List
          itemLayout="horizontal"
          dataSource={activities.filter((act) => act.user === wallet.address)}
          renderItem={(item) => (
            <List.Item style={{ padding: '16px 24px' }}>
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong>{item.type.replace('_', ' ')}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </div>
                }
                description={
                  <div>
                    <Paragraph style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
                      {item.details}
                    </Paragraph>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '11px' }}>
                      <span>Hash: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.txHash ?? `tx_${item.id}`}</span></span>
                      <span>-</span>
                      <span>Fee: <span style={{ fontFamily: 'var(--font-mono)' }}>0.01 XLM</span></span>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

