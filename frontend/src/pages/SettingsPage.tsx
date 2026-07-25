import React, { useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  InputNumber,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  CircleDollarSign,
  Code2,
  Copy,
  ExternalLink,
  GitBranch,
  KeyRound,
  LogOut,
  Network,
  RefreshCw,
  Search,
  Shield,
  Undo2,
  Wallet,
  Coins,
  Sparkles,
  CheckCircle2,
  Sliders,
  Cpu,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { filterWalletActivities } from '../utils/activity';
import { formatAddress, formatCurrency } from '../utils/finance';
import { getConnectedWalletAddress } from '../utils/wallet';
import {
  ASSET_CONTRACTS,
  CONTRACTS,
  EXPLORER_NETWORK,
  HORIZON_URL,
  NETWORK_DISPLAY_NAME,
  NETWORK_PASSPHRASE,
  RPC_URL,
  STELLAR_DECIMALS,
} from '../services/soroban/config';
import type { Transaction } from '../types';

const { Title, Paragraph, Text } = Typography;
const NOTIFICATION_SETTINGS_KEY = 'nexus_notification_settings';

interface SavedSettings {
  emailAlerts: boolean;
  telegramAlerts: boolean;
  liqAlerts: boolean;
  dueAlerts: boolean;
  offerAlerts: boolean;
  inAppAlerts: boolean;
  riskThreshold: number;
  dueReminderDays: number;
}

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
}

interface ValueRowProps {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
}

const toneColors = {
  primary: 'var(--primary-color, #4f46e5)',
  success: 'var(--success-color, #10b981)',
  warning: 'var(--warning-color, #f59e0b)',
  danger: 'var(--danger-color, #ef4444)',
};

const toneBackgrounds = {
  primary: 'rgba(79, 70, 229, 0.12)',
  success: 'rgba(16, 185, 129, 0.12)',
  warning: 'rgba(245, 158, 11, 0.14)',
  danger: 'rgba(239, 68, 68, 0.12)',
};

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
};

const softPanelStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-subtle, #f8fafc)',
  border: '1px solid var(--border-light, #e2e8f0)',
  borderRadius: 12,
  padding: 18,
};

const getExplorerContractUrl = (contractId: string) =>
  `https://stellar.expert/explorer/${EXPLORER_NETWORK}/contract/${contractId}`;

const getExplorerTxUrl = (txHash: string) =>
  `https://stellar.expert/explorer/${EXPLORER_NETWORK}/tx/${txHash}`;

const formatOracleAge = (lastUpdated?: string) => {
  if (!lastUpdated) return 'No timestamp';

  const updatedAt = new Date(lastUpdated).getTime();
  if (!Number.isFinite(updatedAt)) return 'No timestamp';

  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
};

const getTransactionColor = (type: string) => {
  if (type.includes('LIQUIDATE')) return 'red';
  if (type.includes('REPAY') || type.includes('CLAIM')) return 'green';
  if (type.includes('OFFER')) return 'blue';
  if (type.includes('ORACLE')) return 'orange';
  return 'purple';
};

const MetricTile: React.FC<MetricTileProps> = ({ icon, label, value, detail, tone = 'primary' }) => {
  const isAddress = typeof value === 'string' && (value.includes('...') || value.startsWith('G'));

  return (
    <Card
      className="card-premium"
      styles={{ body: { padding: 20 } }}
      style={{
        borderRadius: 16,
        border: '1px solid var(--border-light, #e2e8f0)',
        transition: 'all 0.25s ease',
      }}
    >
      <Space size={14} align="start" style={{ width: '100%' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: toneBackgrounds[tone],
            color: toneColors[tone],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 44px',
            boxShadow: `0 4px 12px ${toneBackgrounds[tone]}`,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </Text>
          <div
            style={{
              marginTop: 4,
              fontSize: isAddress ? 15 : 22,
              fontFamily: isAddress ? 'var(--font-mono, monospace)' : 'inherit',
              lineHeight: 1.2,
              fontWeight: isAddress ? 700 : 900,
              color: 'var(--text-main, #0f172a)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {value}
          </div>
          {detail && (
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {detail}
            </div>
          )}
        </div>
      </Space>
    </Card>
  );
};

const ValueRow: React.FC<ValueRowProps> = ({ label, value, action }) => (
  <div style={rowStyle}>
    <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
      {label}
    </Text>
    <Space size={6} style={{ minWidth: 0 }}>
      <Text strong style={{ textAlign: 'right', wordBreak: 'break-all', fontSize: 13 }}>
        {value}
      </Text>
      {action}
    </Space>
  </div>
);

const ToggleRow: React.FC<ToggleRowProps> = ({ title, description, checked, onChange, icon }) => (
  <div style={{ ...softPanelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
    <Space size={14} align="center">
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: checked ? 'rgba(79, 70, 229, 0.12)' : 'rgba(100, 116, 139, 0.08)',
          color: checked ? 'var(--primary-color, #4f46e5)' : 'var(--text-muted, #64748b)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 38px',
          transition: 'all 0.2s ease',
        }}
      >
        {icon}
      </div>
      <div>
        <Text strong style={{ display: 'block', fontSize: 14 }}>
          {title}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {description}
        </Text>
      </div>
    </Space>
    <Switch checked={checked} onChange={onChange} />
  </div>
);

export const SettingsPage: React.FC = () => {
  const { wallet, transactions, loans, loanOffers, oraclePrices, updateOraclePrice, disconnectWallet, refreshData } = useAppContext();
  const { publicKey, disconnect } = useWallet();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);

  const xlmOracle = oraclePrices.find((p) => p.asset === 'XLM');
  const xlmPrice = xlmOracle?.price || 0.125;
  const connectedAddress = publicKey || wallet.address || '';

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [telegramAlerts, setTelegramAlerts] = useState(false);
  const [liqAlerts, setLiqAlerts] = useState(true);
  const [dueAlerts, setDueAlerts] = useState(true);
  const [offerAlerts, setOfferAlerts] = useState(true);
  const [inAppAlerts, setInAppAlerts] = useState(true);
  const [riskThreshold, setRiskThreshold] = useState(1.2);
  const [dueReminderDays, setDueReminderDays] = useState(3);
  const [newXlmPrice, setNewXlmPrice] = useState<number>(xlmPrice);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState('ALL');

  const notificationSettingsKey = useMemo(
    () => (connectedWalletAddress ? `${NOTIFICATION_SETTINGS_KEY}_${connectedWalletAddress}` : NOTIFICATION_SETTINGS_KEY),
    [connectedWalletAddress]
  );

  const activeOffers = useMemo(
    () => loanOffers.filter((offer) => offer.status === 'Active'),
    [loanOffers]
  );

  const openLoans = useMemo(
    () => loans.filter((loan) => ['Active', 'Warning', 'LiquidationPlanning', 'Expired', 'Defaulted'].includes(loan.status)),
    [loans]
  );

  const atRiskLoans = useMemo(
    () => openLoans.filter((loan) => loan.healthFactor < riskThreshold),
    [openLoans, riskThreshold]
  );

  const avgHealthFactor = openLoans.length > 0
    ? openLoans.reduce((sum, loan) => sum + loan.healthFactor, 0) / openLoans.length
    : 2;

  const walletTransactions = useMemo(
    () => filterWalletActivities(transactions, connectedWalletAddress, loans, loanOffers),
    [connectedWalletAddress, loanOffers, loans, transactions]
  );

  const activityTypes = useMemo(
    () => Array.from(new Set(walletTransactions.map((tx) => tx.type))).sort(),
    [walletTransactions]
  );

  const filteredTransactions = useMemo(
    () => walletTransactions.filter((tx) => {
      const normalizedSearch = activitySearch.trim().toLowerCase();
      const matchesType = activityTypeFilter === 'ALL' || tx.type === activityTypeFilter;
      const matchesSearch =
        !normalizedSearch ||
        tx.type.toLowerCase().includes(normalizedSearch) ||
        tx.details.toLowerCase().includes(normalizedSearch) ||
        tx.id.toLowerCase().includes(normalizedSearch) ||
        tx.txHash?.toLowerCase().includes(normalizedSearch);

      return matchesType && matchesSearch;
    }),
    [activitySearch, activityTypeFilter, walletTransactions]
  );

  const settingsSnapshot = useMemo<SavedSettings>(
    () => ({
      emailAlerts,
      telegramAlerts,
      liqAlerts,
      dueAlerts,
      offerAlerts,
      inAppAlerts,
      riskThreshold,
      dueReminderDays,
    }),
    [dueAlerts, dueReminderDays, emailAlerts, inAppAlerts, liqAlerts, offerAlerts, riskThreshold, telegramAlerts]
  );

  useEffect(() => {
    setNewXlmPrice(xlmPrice);
  }, [xlmPrice]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(notificationSettingsKey);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Partial<SavedSettings>;
      setEmailAlerts(parsed.emailAlerts ?? true);
      setTelegramAlerts(parsed.telegramAlerts ?? false);
      setLiqAlerts(parsed.liqAlerts ?? true);
      setDueAlerts(parsed.dueAlerts ?? true);
      setOfferAlerts(parsed.offerAlerts ?? true);
      setInAppAlerts(parsed.inAppAlerts ?? true);
      setRiskThreshold(parsed.riskThreshold ?? 1.2);
      setDueReminderDays(parsed.dueReminderDays ?? 3);
    } catch {
      // Ignore malformed local settings
    }
  }, [notificationSettingsKey]);

  useEffect(() => {
    localStorage.setItem(notificationSettingsKey, JSON.stringify(settingsSnapshot));
  }, [notificationSettingsKey, settingsSnapshot]);

  const handleCopy = (text: string, id: string) => {
    if (!text) return;

    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
    message.success('Copied to clipboard');
  };

  const copyButton = (text: string, id: string) => (
    <Tooltip title="Copy">
      <Button
        type="text"
        size="small"
        disabled={!text}
        icon={copiedId === id ? <Check size={14} style={{ color: 'var(--success-color, #10b981)' }} /> : <Copy size={14} />}
        onClick={() => handleCopy(text, id)}
        aria-label="Copy"
      />
    </Tooltip>
  );

  const explorerButton = (contractId: string) => (
    <Tooltip title="Open Explorer">
      <Button
        type="text"
        size="small"
        disabled={!contractId}
        icon={<ExternalLink size={14} />}
        href={contractId ? getExplorerContractUrl(contractId) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open Explorer"
      />
    </Tooltip>
  );

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

  const roleRows = [
    {
      key: 'deployer',
      role: 'Deployer / Admin',
      signer: 'Protocol Operator',
      responsibility: 'Deploys contracts, initializes parameters, and updates testnet oracle feeds.',
      tag: 'Admin',
    },
    {
      key: 'maker',
      role: 'Maker / Lender',
      signer: 'Lender Wallet',
      responsibility: 'Funds USDC principal into Soroban escrow contract before marketplace listing.',
      tag: 'Lender',
    },
    {
      key: 'taker',
      role: 'Taker / Borrower',
      signer: 'Borrower Wallet',
      responsibility: 'Accepts live offer, deposits XLM collateral into escrow, and receives USDC.',
      tag: 'Borrower',
    },
    {
      key: 'refund',
      role: 'Refund Path',
      signer: 'Original Lender',
      responsibility: 'Cancels unmatched offer and reclaims escrowed USDC principal.',
      tag: 'Refund',
    },
  ];

  const lifecycleSteps = [
    {
      key: 'make',
      icon: <GitBranch size={18} />,
      label: '1. Create & Fund',
      title: 'Fund Escrow Offer',
      description: 'Lender sets terms and locks USDC principal into Soroban smart contract custody.',
      status: activeOffers.length > 0 ? `${activeOffers.length} live offers` : 'No active offers',
      color: 'blue',
    },
    {
      key: 'take',
      icon: <CircleDollarSign size={18} />,
      label: '2. Accept & Lock',
      title: 'Borrow & Deposit Collateral',
      description: 'Borrower provides XLM collateral and receives the USDC loan atomically.',
      status: `${openLoans.length} active loans`,
      color: 'green',
    },
    {
      key: 'refund',
      icon: <Undo2 size={18} />,
      label: '3. Cancel & Reclaim',
      title: 'Refund Unmatched Funds',
      description: 'Lender can cancel an unmatched offer anytime to reclaim full principal.',
      status: 'Protected by Owner-Auth',
      color: 'orange',
    },
  ];

  const contractRows = [
    {
      key: 'marketplace',
      name: 'Marketplace Contract',
      type: 'Factory',
      purpose: 'Peer-to-peer offer book, matching & routing engine',
      methods: 'create_offer / fund_offer / accept_offer / cancel_offer',
      address: CONTRACTS.marketplace,
    },
    {
      key: 'loan-manager',
      name: 'Loan Manager Contract',
      type: 'Lifecycle',
      purpose: 'Loan accounting, repayments & liquidation risk engine',
      methods: 'repay / add_collateral / liquidate / claim',
      address: CONTRACTS.loanManager,
    },
    {
      key: 'vault',
      name: 'Vault Custody Contract',
      type: 'Custody',
      purpose: 'Non-custodial escrow for principal & collateral funds',
      methods: 'lock_lender_funds / lock_collateral / release',
      address: CONTRACTS.vault,
    },
    {
      key: 'oracle',
      name: 'Oracle Contract',
      type: 'Price Feed',
      purpose: 'XLM/USD reference pricing for Health Factor calculations',
      methods: 'get_price / update_price / set_price_for_assets',
      address: CONTRACTS.oracle,
    },
    {
      key: 'faucet',
      name: 'Testnet Faucet Contract',
      type: 'Utility',
      purpose: 'Distributes Stellar Testnet XLM, USDC & Collateral tokens',
      methods: 'request_tokens / get_eligibility / set_asset_config',
      address: CONTRACTS.faucet,
    },
    {
      key: 'usdc',
      name: 'USDC Token SAC',
      type: 'Asset',
      purpose: 'Borrowed principal and repayment stablecoin asset',
      methods: 'transfer / balance / approve',
      address: ASSET_CONTRACTS.USDC,
    },
    {
      key: 'xlm',
      name: 'XLM Native SAC',
      type: 'Asset',
      purpose: 'Native collateral asset for non-custodial loans',
      methods: 'transfer / balance / approve',
      address: ASSET_CONTRACTS.XLM,
    },
  ];

  const eventRows = [
    { key: 'offer_made', event: 'offer_created', payload: '{ offer_id, lender, loan_amount }', meaning: 'Funded offer is published to marketplace.' },
    { key: 'offer_taken', event: 'offer_matched', payload: '{ offer_id, borrower, loan_id }', meaning: 'Borrower deposits collateral and activates loan.' },
    { key: 'offer_cancelled', event: 'offer_cancelled', payload: '{ offer_id, lender }', meaning: 'Lender reclaims escrowed principal.' },
    { key: 'faucet_claim', event: 'faucet.claim', payload: '{ recipient, asset, amount }', meaning: 'Testnet tokens distributed via Faucet contract.' },
    { key: 'loan_liquidated', event: 'loan_liquidated', payload: '{ loan_id, liquidator, amount }', meaning: 'At-risk position partially or fully liquidated.' },
  ];

  const txColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => (
        <Tag color={getTransactionColor(text)} style={{ margin: 0, fontWeight: 700, borderRadius: 6 }}>
          {text.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (text: string) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{text}</Text>,
    },
    {
      title: 'Value',
      key: 'value',
      render: (_: unknown, record: Transaction) => (
        record.amount > 0 && record.asset ? (
          <Text strong style={{ color: 'var(--primary-color)' }}>
            {formatCurrency(record.amount, record.asset)}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        )
      ),
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
      align: 'right' as const,
      render: (txHash?: string) =>
        txHash ? (
          <Tooltip title="View on Stellar Expert">
            <Button
              type="text"
              size="small"
              icon={<ExternalLink size={14} />}
              href={getExplorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on Stellar Expert"
            />
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  const roleColumns = [
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (text: string, record: { tag: string }) => (
        <Space size={8}>
          <Tag color={record.tag === 'Admin' ? 'purple' : record.tag === 'Lender' ? 'blue' : record.tag === 'Borrower' ? 'green' : 'orange'} style={{ margin: 0, fontWeight: 700 }}>
            {record.tag}
          </Tag>
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Signer Requirement',
      dataIndex: 'signer',
      key: 'signer',
      render: (text: string) => <Text style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Protocol Responsibility',
      dataIndex: 'responsibility',
      key: 'responsibility',
      render: (text: string) => <Text type="secondary" style={{ fontSize: 13 }}>{text}</Text>,
    },
  ];

  const contractColumns = [
    {
      title: 'Contract Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: { type: string; purpose: string }) => (
        <div>
          <Space size={8}>
            <Text strong style={{ fontSize: 14 }}>{text}</Text>
            <Tag color={record.type === 'Asset' ? 'cyan' : record.type === 'Utility' ? 'green' : 'geekblue'} style={{ margin: 0, fontWeight: 600 }}>
              {record.type}
            </Tag>
          </Space>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginTop: 4 }}>
            {record.purpose}
          </div>
        </div>
      ),
    },
    {
      title: 'Entry Methods',
      dataIndex: 'methods',
      key: 'methods',
      render: (text: string) => (
        <Text code style={{ fontSize: 12, whiteSpace: 'normal', borderRadius: 6, padding: '2px 6px' }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Contract Address',
      dataIndex: 'address',
      key: 'address',
      render: (address: string, record: { key: string }) => (
        <Space size={6}>
          <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {address ? formatAddress(address) : 'Not configured'}
          </Text>
          {copyButton(address, `contract-${record.key}`)}
          {explorerButton(address)}
        </Space>
      ),
    },
  ];

  const eventColumns = [
    {
      title: 'Event Topic',
      dataIndex: 'event',
      key: 'event',
      render: (text: string) => <Text code style={{ fontWeight: 700 }}>{text}</Text>,
    },
    {
      title: 'Payload Schema',
      dataIndex: 'payload',
      key: 'payload',
      render: (text: string) => <Text code style={{ fontSize: 12 }}>{text}</Text>,
    },
    {
      title: 'Protocol Meaning',
      dataIndex: 'meaning',
      key: 'meaning',
      render: (text: string) => <Text type="secondary" style={{ fontSize: 13 }}>{text}</Text>,
    },
  ];

  const walletTab = (
    <div style={panelStyle}>
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <Card className="card-premium" title={<Space><Wallet size={18} /> Connected Wallet & Balance</Space>}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <ValueRow
                label="Wallet Address"
                value={connectedAddress ? formatAddress(connectedAddress) : 'Disconnected'}
                action={copyButton(connectedAddress, 'wallet')}
              />
              <ValueRow
                label="Network"
                value={
                  <Tag color={NETWORK_DISPLAY_NAME.includes('Mainnet') ? 'green' : 'blue'} style={{ margin: 0, fontWeight: 700 }}>
                    {NETWORK_DISPLAY_NAME}
                  </Tag>
                }
              />
              <ValueRow label="USDC Stablecoin Balance" value={formatCurrency(wallet.balanceUSDC || 0, 'USDC')} />
              <ValueRow label="XLM Collateral Balance" value={`${(wallet.balanceXLM || 0).toLocaleString()} XLM`} />
              
              <Divider style={{ margin: '4px 0' }} />
              
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={10}>
                  <Button icon={<RefreshCw size={14} />} onClick={() => refreshData()} style={{ borderRadius: 8 }}>
                    Refresh Balances
                  </Button>
                  <Button
                    type="primary"
                    icon={<Coins size={14} />}
                    onClick={() => navigate('/faucet?returnTo=/app/settings')}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    Get Test Tokens
                  </Button>
                </Space>

                <Button danger icon={<LogOut size={14} />} onClick={handleDisconnect} style={{ borderRadius: 8 }}>
                  Disconnect
                </Button>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card className="card-premium" title={<Space><KeyRound size={18} /> Protocol Escrow Role Model</Space>}>
            <Table
              columns={roleColumns}
              dataSource={roleRows}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ x: 620 }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="card-premium" title={<Space><GitBranch size={18} /> Soroban Escrow Lifecycle Architecture</Space>}>
        <Row gutter={[16, 16]}>
          {lifecycleSteps.map((step) => (
            <Col xs={24} md={8} key={step.key}>
              <div style={{ ...softPanelStyle, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <Space size={12} align="start" style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(79, 70, 229, 0.12)',
                        color: 'var(--primary-color, #4f46e5)',
                      }}
                    >
                      {step.icon}
                    </div>
                    <div>
                      <Tag color={step.color} style={{ marginBottom: 4, fontWeight: 700 }}>
                        {step.label}
                      </Tag>
                      <Text strong style={{ display: 'block', fontSize: 16 }}>
                        {step.title}
                      </Text>
                    </div>
                  </Space>
                  <Text type="secondary" style={{ display: 'block', fontSize: 13, lineHeight: '1.5' }}>
                    {step.description}
                  </Text>
                </div>
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-light, #e2e8f0)' }}>
                  <Text strong style={{ fontSize: 12, color: 'var(--primary-color, #4f46e5)' }}>
                    {step.status}
                  </Text>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );

  const alertsTab = (
    <Row gutter={[20, 20]}>
      <Col xs={24} xl={14}>
        <Card className="card-premium" title={<Space><Bell size={18} /> Protocol Notification Preferences</Space>}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <ToggleRow
              title="In-App Notification Stream"
              description="Display live protocol events and transaction status toasts in app stream."
              checked={inAppAlerts}
              onChange={setInAppAlerts}
              icon={<Activity size={18} />}
            />
            <ToggleRow
              title="Liquidation Health Factor Warnings"
              description={`Trigger urgent alert when loan health factor drops below ${riskThreshold.toFixed(2)}.`}
              checked={liqAlerts}
              onChange={setLiqAlerts}
              icon={<AlertTriangle size={18} />}
            />
            <ToggleRow
              title="Loan Due Date Reminders"
              description={`Send notification ${dueReminderDays} day${dueReminderDays === 1 ? '' : 's'} before loan maturity.`}
              checked={dueAlerts}
              onChange={setDueAlerts}
              icon={<Bell size={18} />}
            />
            <ToggleRow
              title="Offer Lifecycle & Match Updates"
              description="Notify when your offers are funded, matched by a borrower, or cancelled."
              checked={offerAlerts}
              onChange={setOfferAlerts}
              icon={<GitBranch size={18} />}
            />
            <ToggleRow
              title="Email Digest Notifications"
              description="Receive weekly portfolio summaries and risk reports via email."
              checked={emailAlerts}
              onChange={setEmailAlerts}
              icon={<Shield size={18} />}
            />
          </Space>
        </Card>
      </Col>

      <Col xs={24} xl={10}>
        <Card className="card-premium" title={<Space><Sliders size={18} /> Risk Guard Controls</Space>}>
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            <div>
              <Text strong style={{ fontSize: 14 }}>Health Factor Warning Threshold</Text>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: '2px 0 10px 0' }}>
                Threshold for flagging active loans as Warning status.
              </Paragraph>
              <Segmented
                block
                value={riskThreshold}
                onChange={(value) => setRiskThreshold(Number(value))}
                options={[
                  { label: '1.40 (Conservative)', value: 1.4 },
                  { label: '1.20 (Standard)', value: 1.2 },
                  { label: '1.00 (Critical)', value: 1 },
                ]}
              />
            </div>

            <div>
              <Text strong style={{ fontSize: 14 }}>Due Reminder Lead Time</Text>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: '2px 0 10px 0' }}>
                Days before loan maturity to trigger repayment reminders.
              </Paragraph>
              <InputNumber
                style={{ width: '100%', borderRadius: 8 }}
                size="large"
                min={1}
                max={30}
                value={dueReminderDays}
                onChange={(value) => setDueReminderDays(value || 3)}
                addonAfter="days"
              />
            </div>

            <div style={softPanelStyle}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <ValueRow label="Total Active Loans" value={openLoans.length} />
                <ValueRow
                  label="Loans Below Threshold"
                  value={
                    <Text strong style={{ color: atRiskLoans.length > 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                      {atRiskLoans.length}
                    </Text>
                  }
                />
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Average Portfolio Health Factor</Text>
                    <Text strong style={{ color: avgHealthFactor < riskThreshold ? 'var(--danger-color)' : 'var(--success-color)' }}>
                      {avgHealthFactor.toFixed(2)}
                    </Text>
                  </div>
                  <Progress
                    percent={Math.min(100, Math.round((Math.min(avgHealthFactor, 2) / 2) * 100))}
                    showInfo={false}
                    strokeColor={avgHealthFactor < riskThreshold ? 'var(--danger-color)' : 'var(--success-color)'}
                  />
                </div>
              </Space>
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );

  const contractsTab = (
    <div style={panelStyle}>
      <Card className="card-premium" title={<Space><Network size={18} /> Soroban Smart Contract Registry</Space>}>
        <Table
          columns={contractColumns}
          dataSource={contractRows}
          rowKey="key"
          pagination={false}
          scroll={{ x: 920 }}
        />
      </Card>

      <Card className="card-premium" title={<Space><Activity size={18} /> Soroban Contract Event Topics</Space>}>
        <Table
          columns={eventColumns}
          dataSource={eventRows}
          rowKey="key"
          pagination={false}
          size="small"
          scroll={{ x: 680 }}
        />
      </Card>
    </div>
  );

  const developerTab = (
    <Row gutter={[20, 20]}>
      <Col xs={24} xl={12}>
        <Card className="card-premium" title={<Space><Code2 size={18} /> Stellar Testnet RPC Runtime</Space>}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <ValueRow label="Soroban RPC Endpoint" value={<Text code style={{ whiteSpace: 'normal', fontSize: 12 }}>{RPC_URL}</Text>} />
            <ValueRow label="Horizon API Endpoint" value={<Text code style={{ whiteSpace: 'normal', fontSize: 12 }}>{HORIZON_URL}</Text>} />
            <ValueRow label="Network Passphrase" value={<Text code style={{ whiteSpace: 'normal', fontSize: 12 }}>{NETWORK_PASSPHRASE}</Text>} />
            <ValueRow label="Asset Decimals" value={`${STELLAR_DECIMALS} decimal places (stroops)`} />
            
            <Divider style={{ margin: '4px 0' }} />
            
            <div style={softPanelStyle}>
              <Space size={10} align="start">
                <Cpu size={20} style={{ color: 'var(--primary-color)', flex: '0 0 20px', marginTop: 2 }} />
                <div>
                  <Text strong style={{ display: 'block' }}>CLI & Smart Contract Parity</Text>
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: '1.5' }}>
                    The Nexus UI mirrors Soroban contract architecture: deploy contracts once, fund offers via Vault, accept offers via Marketplace, and manage risk via Loan Manager.
                  </Text>
                </div>
              </Space>
            </div>
          </Space>
        </Card>
      </Col>

      <Col xs={24} xl={12}>
        <Card className="card-premium" title={<Space><CircleDollarSign size={18} /> Testnet Oracle Price Controller</Space>}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div style={softPanelStyle}>
              <ValueRow label="Current XLM/USD Reference Price" value={`$${xlmPrice.toFixed(4)}`} />
              <ValueRow label="Last Oracle Timestamp" value={formatOracleAge(xlmOracle?.lastUpdated)} />
              <ValueRow label="Loans at Risk Under Current Price" value={atRiskLoans.length} />
            </div>

            <div>
              <Text strong style={{ fontSize: 14 }}>Simulate Market Price Movement</Text>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: '2px 0 10px 0' }}>
                Update XLM oracle price to test health factor changes, warnings, and liquidation triggers.
              </Paragraph>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <InputNumber
                  style={{ flex: 1, minWidth: 180, borderRadius: 8 }}
                  size="large"
                  min={0.01}
                  max={10}
                  step={0.01}
                  value={newXlmPrice}
                  onChange={(value) => setNewXlmPrice(value || 0.125)}
                  addonBefore="XLM / USD"
                />
                <Button type="primary" size="large" onClick={handleUpdateOraclePrice} style={{ borderRadius: 8, fontWeight: 700 }}>
                  Update Price
                </Button>
              </div>
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );

  const activityTab = (
    <Card className="card-premium" title={<Space><Activity size={18} /> Complete Wallet Protocol Log</Space>}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search transactions by ID, hash, or details..."
            prefix={<Search size={16} style={{ color: 'var(--text-muted)' }} />}
            value={activitySearch}
            onChange={(event) => setActivitySearch(event.target.value)}
            style={{ flex: 1, minWidth: 260, borderRadius: 8 }}
            allowClear
          />
          <Select
            value={activityTypeFilter}
            onChange={setActivityTypeFilter}
            style={{ width: 240, borderRadius: 8 }}
            options={[
              { value: 'ALL', label: 'All Activity Types' },
              ...activityTypes.map((type) => ({ value: type, label: type.replace(/_/g, ' ') })),
            ]}
          />
        </div>

        <Table
          columns={txColumns}
          dataSource={filteredTransactions}
          rowKey="id"
          pagination={{ pageSize: 8 }}
          scroll={{ x: 860 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No matching protocol activity"
              />
            ),
          }}
        />
      </Space>
    </Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Hero Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)',
          border: '1px solid var(--border-light, #e2e8f0)',
          borderRadius: 20,
          padding: '28px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.03)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Sparkles size={20} style={{ color: 'var(--primary-color, #4f46e5)' }} />
            <Title level={2} style={{ margin: 0, fontWeight: 900, fontSize: 26, letterSpacing: '-0.5px' }}>
              Protocol Settings & Controls
            </Title>
          </div>
          <Paragraph type="secondary" style={{ margin: 0, fontSize: 14, maxWidth: 540 }}>
            Manage wallet identity, Soroban smart contract references, risk guard thresholds, and testnet runtime parameters.
          </Paragraph>
        </div>

        <Space wrap size={10}>
          <Tag color="blue" icon={<Zap size={12} />} style={{ padding: '6px 12px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}>
            {NETWORK_DISPLAY_NAME}
          </Tag>
          <Tag color={connectedAddress ? 'green' : 'red'} icon={<CheckCircle2 size={12} />} style={{ padding: '6px 12px', fontSize: 13, fontWeight: 700, borderRadius: 8 }}>
            {connectedAddress ? 'Wallet Connected' : 'Disconnected'}
          </Tag>
          <Button
            type="primary"
            icon={<Coins size={16} />}
            onClick={() => navigate('/faucet?returnTo=/app/settings')}
            style={{ borderRadius: 10, fontWeight: 700, height: 40 }}
          >
            Get Test Tokens
          </Button>
        </Space>
      </div>

      {/* 4 Hero Metric Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <MetricTile
            icon={<Wallet size={20} />}
            label="Active Wallet"
            value={connectedAddress ? formatAddress(connectedAddress) : 'Disconnected'}
            detail={connectedAddress ? (wallet.role ? `${wallet.role} Mode` : 'Stellar Testnet Account') : 'No wallet connected'}
            tone={connectedAddress ? 'success' : 'danger'}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricTile
            icon={<GitBranch size={20} />}
            label="Live Marketplace Offers"
            value={activeOffers.length}
            detail="Funded Soroban offers"
            tone="primary"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricTile
            icon={<Shield size={20} />}
            label="Risk Watchlist"
            value={atRiskLoans.length}
            detail={`HF below ${riskThreshold.toFixed(2)}`}
            tone={atRiskLoans.length > 0 ? 'danger' : 'success'}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <MetricTile
            icon={<CircleDollarSign size={20} />}
            label="XLM Reference Oracle"
            value={`$${xlmPrice.toFixed(4)}`}
            detail={formatOracleAge(xlmOracle?.lastUpdated)}
            tone="warning"
          />
        </Col>
      </Row>

      {/* Main Tabbed Container */}
      <Card className="card-premium" styles={{ body: { padding: 0 } }} style={{ borderRadius: 20, overflow: 'hidden' }}>
        <Tabs
          defaultActiveKey="wallet"
          tabBarStyle={{ margin: 0, padding: '4px 20px 0 20px', background: 'var(--bg-subtle, #f8fafc)', borderBottom: '1px solid var(--border-light, #e2e8f0)' }}
          items={[
            { key: 'wallet', label: <Space><Wallet size={16} /> Wallet & Role</Space>, children: <div style={{ padding: 24 }}>{walletTab}</div> },
            { key: 'alerts', label: <Space><Bell size={16} /> Alerts & Risk</Space>, children: <div style={{ padding: 24 }}>{alertsTab}</div> },
            { key: 'contracts', label: <Space><Network size={16} /> Soroban Contracts</Space>, children: <div style={{ padding: 24 }}>{contractsTab}</div> },
            { key: 'developer', label: <Space><Code2 size={16} /> Developer & Oracle</Space>, children: <div style={{ padding: 24 }}>{developerTab}</div> },
            { key: 'activity', label: <Space><Activity size={16} /> Protocol Activity</Space>, children: <div style={{ padding: 24 }}>{activityTab}</div> },
          ]}
        />
      </Card>
    </div>
  );
};
