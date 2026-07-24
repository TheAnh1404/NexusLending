import React, { useEffect, useState } from 'react';
import { Typography, Row, Col, Card, Button, Switch, Table, Tag, Space, Divider, InputNumber, App } from 'antd';
import { LogOut, ExternalLink, RefreshCw, Check, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { formatAddress } from '../utils/finance';
import { filterWalletActivities } from '../utils/activity';
import { getConnectedWalletAddress } from '../utils/wallet';
import {
  ASSET_CONTRACTS,
  CONTRACTS,
  EXPLORER_NETWORK,
  NETWORK_DISPLAY_NAME,
} from '../services/soroban/config';

const { Title, Paragraph, Text } = Typography;
const NOTIFICATION_SETTINGS_KEY = 'nexus_notification_settings';

export const SettingsPage: React.FC = () => {
  const { wallet, transactions, loans, loanOffers, oraclePrices, updateOraclePrice, disconnectWallet, refreshData } = useAppContext();
  const { publicKey, disconnect } = useWallet();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [telegramAlerts, setTelegramAlerts] = useState(false);
  const [liqAlerts, setLiqAlerts] = useState(true);

  const [newXlmPrice, setNewXlmPrice] = useState<number>(
    oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const notificationSettingsKey = React.useMemo(
    () => (connectedWalletAddress ? `${NOTIFICATION_SETTINGS_KEY}_${connectedWalletAddress}` : NOTIFICATION_SETTINGS_KEY),
    [connectedWalletAddress]
  );

  const walletTransactions = React.useMemo(
    () => filterWalletActivities(transactions, connectedWalletAddress, loans, loanOffers),
    [connectedWalletAddress, loanOffers, loans, transactions]
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(notificationSettingsKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      setEmailAlerts(parsed.emailAlerts ?? true);
      setTelegramAlerts(parsed.telegramAlerts ?? false);
      setLiqAlerts(parsed.liqAlerts ?? true);
    } catch {
      // Ignored
    }
  }, [notificationSettingsKey]);

  useEffect(() => {
    localStorage.setItem(
      notificationSettingsKey,
      JSON.stringify({ emailAlerts, telegramAlerts, liqAlerts })
    );
  }, [emailAlerts, liqAlerts, notificationSettingsKey, telegramAlerts]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    message.success('Copied to clipboard');
  };

  const handleDisconnect = () => {
    disconnect();
    disconnectWallet();
    navigate('/connect');
  };

  const handleUpdateOraclePrice = async () => {
    try {
      await updateOraclePrice(newXlmPrice);
      message.success(`Oracle price updated to $${newXlmPrice}`);
    } catch {
      message.error('Failed to update oracle price.');
    }
  };

  // Transaction history table columns
  const txColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => (
        <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>
          {text.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (text: string) => <Text style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (text: string) => <Text type="secondary" style={{ fontSize: 12 }}>{new Date(text).toLocaleString()}</Text>,
    },
    {
      title: 'Explorer',
      dataIndex: 'txHash',
      key: 'txHash',
      render: (txHash?: string) =>
        txHash ? (
          <a
            href={`https://stellar.expert/explorer/${EXPLORER_NETWORK}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary-color)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
          >
            <span>View</span>
            <ExternalLink size={12} />
          </a>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <Title level={2} style={{ margin: 0, fontWeight: 800 }}>
          Settings & Preferences
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 14 }}>
          Manage your connected wallet, notification settings, contract references, and developer options.
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column: Wallet & Notifications */}
        <Col xs={24} lg={12}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Section 1: Wallet Connection */}
            <Card className="card-premium" title={<Text strong style={{ fontSize: 16 }}>Connected Wallet</Text>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">Wallet Address</Text>
                  <Space size={6}>
                    <Text strong style={{ fontFamily: 'monospace' }}>
                      {formatAddress(publicKey || wallet.address || '')}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={copiedId === 'wallet' ? <Check size={14} style={{ color: 'var(--success-color)' }} /> : <Copy size={14} />}
                      onClick={() => handleCopy(publicKey || wallet.address || '', 'wallet')}
                    />
                  </Space>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary">Stellar Network</Text>
                  <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600, margin: 0 }}>
                    {NETWORK_DISPLAY_NAME}
                  </Tag>
                </div>

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ display: 'flex', gap: 12 }}>
                  <Button icon={<RefreshCw size={14} />} onClick={() => refreshData()} style={{ borderRadius: 8 }}>
                    Refresh Balances
                  </Button>
                  <Button danger icon={<LogOut size={14} />} onClick={handleDisconnect} style={{ borderRadius: 8 }}>
                    Disconnect Wallet
                  </Button>
                </div>
              </div>
            </Card>

            {/* Section 2: Notifications */}
            <Card className="card-premium" title={<Text strong style={{ fontSize: 16 }}>Notifications</Text>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Liquidation Risk Alerts</Text>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Receive alerts when loan Health Factor drops below 1.2
                    </div>
                  </div>
                  <Switch checked={liqAlerts} onChange={setLiqAlerts} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Email Notifications</Text>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Receive loan repayment due reminders via email
                    </div>
                  </div>
                  <Switch checked={emailAlerts} onChange={setEmailAlerts} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong>Telegram Notifications</Text>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Instant updates via Nexus Telegram Bot
                    </div>
                  </div>
                  <Switch checked={telegramAlerts} onChange={setTelegramAlerts} />
                </div>
              </div>
            </Card>
          </Space>
        </Col>

        {/* Right Column: Contracts & Developer Admin */}
        <Col xs={24} lg={12}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Section 3: Soroban Contract Addresses */}
            <Card className="card-premium" title={<Text strong style={{ fontSize: 16 }}>Smart Contract References</Text>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Marketplace Contract</Text>
                  <Text strong style={{ fontFamily: 'monospace' }}>{formatAddress(CONTRACTS.marketplace)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Loan Manager Contract</Text>
                  <Text strong style={{ fontFamily: 'monospace' }}>{formatAddress(CONTRACTS.loanManager)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Oracle Contract</Text>
                  <Text strong style={{ fontFamily: 'monospace' }}>{formatAddress(CONTRACTS.oracle)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">USDC SAC Token</Text>
                  <Text strong style={{ fontFamily: 'monospace' }}>{formatAddress(ASSET_CONTRACTS.USDC)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">XLM SAC Token</Text>
                  <Text strong style={{ fontFamily: 'monospace' }}>{formatAddress(ASSET_CONTRACTS.XLM)}</Text>
                </div>
              </div>
            </Card>

            {/* Section 4: Oracle Price Admin Update */}
            <Card className="card-premium" title={<Text strong style={{ fontSize: 16 }}>Oracle Price Control (Dev/Admin)</Text>}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Update XLM/USD oracle asset price on Soroban oracle contract to simulate price movements.
                </Text>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <InputNumber
                    style={{ flex: 1, borderRadius: 8 }}
                    size="large"
                    min={0.01}
                    max={10.0}
                    step={0.01}
                    value={newXlmPrice}
                    onChange={(val) => setNewXlmPrice(val || 0.125)}
                    addonBefore="XLM / USD"
                  />
                  <Button type="primary" size="large" onClick={handleUpdateOraclePrice} style={{ borderRadius: 8 }}>
                    Update Price
                  </Button>
                </div>
              </div>
            </Card>
          </Space>
        </Col>
      </Row>

      {/* Transaction History Section */}
      <Card className="card-premium" title={<Text strong style={{ fontSize: 16 }}>Transaction History</Text>}>
        <Table columns={txColumns} dataSource={walletTransactions} rowKey="id" pagination={{ pageSize: 5 }} />
      </Card>
    </div>
  );
};
