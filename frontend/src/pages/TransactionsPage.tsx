import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Input,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Layers,
  ListFilter,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';

import { useAppContext } from '../app/AppContext';
import type { Transaction, TransactionType } from '../types';
import { formatCurrency } from '../utils/finance';

const { Title, Text, Paragraph } = Typography;

// Institutional Color Matrix for Soroban Transaction Types
const TRANSACTION_CONFIG: Record<
  TransactionType,
  { label: string; color: string; bg: string; border: string; category: string; icon: React.ReactNode }
> = {
  CONNECT_WALLET: {
    label: 'Connect Wallet',
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.08)',
    border: 'rgba(99, 102, 241, 0.25)',
    category: 'system',
    icon: <Wallet size={14} />,
  },
  CREATE_OFFER: {
    label: 'Create Offer',
    color: '#D97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(217, 119, 6, 0.25)',
    category: 'offers',
    icon: <FileText size={14} />,
  },
  FUND_OFFER: {
    label: 'Fund Escrow',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.3)',
    category: 'offers',
    icon: <Database size={14} />,
  },
  ACTIVATE_OFFER: {
    label: 'Activate Offer',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.25)',
    category: 'offers',
    icon: <CheckCircle2 size={14} />,
  },
  CANCEL_OFFER: {
    label: 'Cancel Offer',
    color: '#64748B',
    bg: 'rgba(100, 116, 139, 0.08)',
    border: 'rgba(100, 116, 139, 0.2)',
    category: 'offers',
    icon: <XCircle size={14} />,
  },
  EXPIRE_OFFER: {
    label: 'Expire Offer',
    color: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.08)',
    border: 'rgba(148, 163, 184, 0.2)',
    category: 'offers',
    icon: <Clock size={14} />,
  },
  ACCEPT_OFFER: {
    label: 'Accept Offer',
    color: '#0284C7',
    bg: 'rgba(2, 132, 199, 0.08)',
    border: 'rgba(2, 132, 199, 0.25)',
    category: 'loans',
    icon: <ArrowUpRight size={14} />,
  },
  ACTIVATE_LOAN: {
    label: 'Activate Loan',
    color: '#06B6D4',
    bg: 'rgba(6, 182, 212, 0.08)',
    border: 'rgba(6, 182, 212, 0.25)',
    category: 'loans',
    icon: <Zap size={14} />,
  },
  BORROW_LOAN: {
    label: 'Borrow Loan',
    color: '#2563EB',
    bg: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(37, 99, 235, 0.25)',
    category: 'loans',
    icon: <ArrowUpRight size={14} />,
  },
  BORROW: {
    label: 'Borrow',
    color: '#2563EB',
    bg: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(37, 99, 235, 0.25)',
    category: 'loans',
    icon: <ArrowUpRight size={14} />,
  },
  ADD_COLLATERAL: {
    label: 'Add Collateral',
    color: '#0EA5E9',
    bg: 'rgba(14, 165, 233, 0.08)',
    border: 'rgba(14, 165, 233, 0.25)',
    category: 'collateral',
    icon: <Layers size={14} />,
  },
  PARTIAL_REPAY: {
    label: 'Partial Repay',
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.08)',
    border: 'rgba(5, 150, 105, 0.25)',
    category: 'repayments',
    icon: <ArrowDownLeft size={14} />,
  },
  FULL_REPAY: {
    label: 'Full Repay',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    category: 'repayments',
    icon: <CheckCircle2 size={14} />,
  },
  REPAY: {
    label: 'Repay',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.25)',
    category: 'repayments',
    icon: <ArrowDownLeft size={14} />,
  },
  UPDATE_ORACLE: {
    label: 'Oracle Update',
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.08)',
    border: 'rgba(139, 92, 246, 0.25)',
    category: 'oracle',
    icon: <Activity size={14} />,
  },
  LIQUIDATE: {
    label: 'Liquidate Loan',
    color: '#DC2626',
    bg: 'rgba(220, 38, 38, 0.12)',
    border: 'rgba(220, 38, 38, 0.35)',
    category: 'liquidations',
    icon: <AlertTriangle size={14} />,
  },
  CLAIM_REPAYMENT: {
    label: 'Claim Principal',
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.08)',
    border: 'rgba(5, 150, 105, 0.25)',
    category: 'repayments',
    icon: <TrendingUp size={14} />,
  },
};

const shortValue = (value?: string, head = 6, tail = 6): string => {
  if (!value) return '-';
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
};

const formatActionLabel = (type: TransactionType): string => {
  return TRANSACTION_CONFIG[type]?.label ?? type.replace(/_/g, ' ');
};

const formatTime = (timestamp?: string): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getTimeAgo = (timestamp?: string): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const matchesSearch = (transaction: Transaction, search: string): boolean => {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;
  return [
    transaction.type,
    TRANSACTION_CONFIG[transaction.type]?.label,
    transaction.user,
    transaction.asset,
    transaction.details,
    transaction.loanId,
    transaction.offerId,
    transaction.txHash,
    transaction.contract,
    transaction.ledger?.toString(),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedSearch));
};

export const TransactionsPage: React.FC = () => {
  const { transactions, refreshData, wallet } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryLoanId = query.get('loanId') ?? '';
  const queryOfferId = query.get('offerId') ?? '';
  const queryWallet = query.get('wallet') ?? '';
  const queryType = query.get('type') as TransactionType | null;

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<TransactionType | undefined>(queryType ?? undefined);
  const [quickPreset, setQuickPreset] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'simulated'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  
  // Interactive UI state
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);
  const [simulatedLedger, setSimulatedLedger] = useState(49829310);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('tx-search-input');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live ledger block pulse simulator
  useEffect(() => {
    if (!isLiveStreaming) return;
    const interval = setInterval(() => {
      setSimulatedLedger((prev) => prev + 1);
    }, 5500);
    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const typeOptions = useMemo(() => {
    const typesInUse = Array.from(new Set(transactions.map((transaction) => transaction.type))).sort();
    return typesInUse.map((type) => ({
      label: formatActionLabel(type),
      value: type,
    }));
  }, [transactions]);

  // Filtered transactions computation
  const filteredTransactions = useMemo(() => {
    const now = Date.now();
    return transactions
      .filter((transaction) => !queryLoanId || transaction.loanId === queryLoanId)
      .filter((transaction) => !queryOfferId || transaction.offerId === queryOfferId)
      .filter((transaction) => !queryWallet || transaction.user === queryWallet)
      .filter((transaction) => !selectedType || transaction.type === selectedType)
      .filter((transaction) => matchesSearch(transaction, search))
      .filter((transaction) => {
        if (statusFilter === 'verified') return !!transaction.txHash;
        if (statusFilter === 'simulated') return !transaction.txHash;
        return true;
      })
      .filter((transaction) => {
        if (timeRange === 'all') return true;
        const txTime = new Date(transaction.timestamp).getTime();
        if (Number.isNaN(txTime)) return true;
        const diffMs = now - txTime;
        if (timeRange === '24h') return diffMs <= 86400000;
        if (timeRange === '7d') return diffMs <= 7 * 86400000;
        if (timeRange === '30d') return diffMs <= 30 * 86400000;
        return true;
      })
      .filter((transaction) => {
        if (quickPreset === 'all') return true;
        if (quickPreset === 'liquidations') return transaction.type === 'LIQUIDATE';
        if (quickPreset === 'repayments')
          return ['FULL_REPAY', 'PARTIAL_REPAY', 'REPAY', 'CLAIM_REPAYMENT'].includes(transaction.type);
        if (quickPreset === 'offers')
          return ['CREATE_OFFER', 'FUND_OFFER', 'ACTIVATE_OFFER', 'CANCEL_OFFER', 'EXPIRE_OFFER'].includes(transaction.type);
        if (quickPreset === 'loans')
          return ['ACCEPT_OFFER', 'ACTIVATE_LOAN', 'BORROW_LOAN', 'BORROW'].includes(transaction.type);
        if (quickPreset === 'collateral') return transaction.type === 'ADD_COLLATERAL';
        if (quickPreset === 'oracle') return transaction.type === 'UPDATE_ORACLE';
        if (quickPreset === 'my_wallet') return wallet.address && transaction.user === wallet.address;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [
    transactions,
    queryLoanId,
    queryOfferId,
    queryWallet,
    selectedType,
    search,
    statusFilter,
    timeRange,
    quickPreset,
    wallet.address,
  ]);

  // Key institutional metrics
  const totalVolumeUSD = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => {
      // Rough conversion logic: XLM ~ $0.12, USDC ~ $1.00
      const multiplier = tx.asset === 'XLM' ? 0.12 : 1.0;
      return sum + (tx.amount || 0) * multiplier;
    }, 0);
  }, [filteredTransactions]);

  const verifiedCount = useMemo(() => {
    return filteredTransactions.filter((transaction) => transaction.txHash).length;
  }, [filteredTransactions]);

  const verifiedPercentage = useMemo(() => {
    if (!filteredTransactions.length) return 0;
    return Math.round((verifiedCount / filteredTransactions.length) * 100);
  }, [filteredTransactions.length, verifiedCount]);

  const uniqueWallets = useMemo(() => {
    return new Set(filteredTransactions.map((transaction) => transaction.user).filter(Boolean)).size;
  }, [filteredTransactions]);

  const liquidationCount = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.type === 'LIQUIDATE').length;
  }, [filteredTransactions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCSV = () => {
    if (!filteredTransactions.length) return;
    const headers = ['ID', 'Timestamp', 'Type', 'Amount', 'Asset', 'Wallet', 'LoanId', 'OfferId', 'Contract', 'Ledger', 'TxHash', 'Details'];
    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.timestamp,
      tx.type,
      tx.amount,
      tx.asset,
      tx.user,
      tx.loanId || '',
      tx.offerId || '',
      tx.contract || '',
      tx.ledger || '',
      tx.txHash || '',
      `"${(tx.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nexus_transactions_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table Columns
  const columns: ColumnsType<Transaction> = [
    {
      title: 'Action & Status',
      dataIndex: 'type',
      key: 'type',
      width: 200,
      render: (type: TransactionType, record) => {
        const conf = TRANSACTION_CONFIG[type] || {
          label: formatActionLabel(type),
          color: '#4F46E5',
          bg: 'rgba(79,70,229,0.08)',
          border: 'rgba(79,70,229,0.2)',
          icon: <Activity size={14} />,
        };

        return (
          <Space direction="vertical" size={2}>
            <Tag
              style={{
                color: conf.color,
                backgroundColor: conf.bg,
                borderColor: conf.border,
                fontWeight: 700,
                borderRadius: 6,
                padding: '3px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                letterSpacing: '0.03em',
                boxShadow: type === 'LIQUIDATE' ? '0 0 10px rgba(239, 68, 68, 0.25)' : 'none',
              }}
            >
              {conf.icon}
              {conf.label}
            </Tag>
            <Space size={4}>
              {record.txHash ? (
                <Text style={{ fontSize: 10, color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <ShieldCheck size={10} /> Verified On-Chain
                </Text>
              ) : (
                <Text style={{ fontSize: 10, color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <Clock size={10} /> Simulated Record
                </Text>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Volume / Amount',
      key: 'amount',
      width: 160,
      sorter: (a, b) => a.amount - b.amount,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 14, fontFamily: 'var(--font-heading)', color: '#0F172A' }}>
            {formatCurrency(record.amount, record.asset)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            {record.asset}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Account / Wallet',
      dataIndex: 'user',
      key: 'user',
      width: 170,
      render: (user: string) => {
        const isUserWallet = wallet.address && user === wallet.address;
        const key = `user-${user}`;
        return (
          <Space direction="vertical" size={2}>
            <Space size={4}>
              <Text
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: isUserWallet ? 700 : 500,
                  color: isUserWallet ? '#4F46E5' : 'inherit',
                }}
              >
                {shortValue(user)}
              </Text>
              <Tooltip title={copiedKey === key ? 'Copied!' : 'Copy Address'}>
                <Button
                  type="text"
                  size="small"
                  icon={copiedKey === key ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(user, key);
                  }}
                  style={{ width: 20, height: 20, padding: 0 }}
                />
              </Tooltip>
            </Space>
            {isUserWallet && (
              <Tag color="indigo" style={{ fontSize: 9, margin: 0, padding: '0 4px', lineHeight: '14px' }}>
                You
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Entity Link',
      key: 'entity',
      width: 190,
      render: (_, record) => {
        const entityId = record.loanId ?? record.offerId;
        if (!entityId) return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
        return (
          <Space size={6} wrap>
            {record.loanId ? (
              <Tag color="blue" style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>
                LOAN
              </Tag>
            ) : (
              <Tag color="gold" style={{ margin: 0, fontSize: 10, fontWeight: 700 }}>
                OFFER
              </Tag>
            )}
            <Button
              type="link"
              size="small"
              icon={<ArrowRight size={12} />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(record.loanId ? `/app/loans/${record.loanId}` : `/app/marketplace`);
              }}
              style={{
                padding: 0,
                height: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {shortValue(entityId, 4, 4)}
            </Button>
          </Space>
        );
      },
    },
    {
      title: 'Ledger & Proof',
      key: 'receipt',
      width: 190,
      render: (_, record) => {
        const key = `tx-${record.txHash}`;
        if (!record.txHash) {
          return (
            <Space direction="vertical" size={0}>
              <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
                Local Mock
              </Text>
              {record.ledger && (
                <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748B' }}>
                  #{record.ledger}
                </Text>
              )}
            </Space>
          );
        }

        return (
          <Space direction="vertical" size={2}>
            <Space size={4}>
              <a
                href={record.explorerUrl || `https://stellar.expert/explorer/testnet/tx/${record.txHash}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: '#4F46E5',
                  fontWeight: 600,
                }}
              >
                {shortValue(record.txHash, 4, 4)} <ExternalLink size={11} />
              </a>
              <Tooltip title={copiedKey === key ? 'Copied!' : 'Copy TxHash'}>
                <Button
                  type="text"
                  size="small"
                  icon={copiedKey === key ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(record.txHash!, key);
                  }}
                  style={{ width: 20, height: 20, padding: 0 }}
                />
              </Tooltip>
            </Space>
            {record.ledger && (
              <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#64748B' }}>
                Ledger #{record.ledger}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      sorter: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      render: (timestamp?: string, record?: Transaction) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12, fontWeight: 500, color: '#0F172A' }}>
            {getTimeAgo(record?.blockTimestamp ?? timestamp)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {formatTime(record?.blockTimestamp ?? timestamp)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Audit Detail & Action',
      key: 'details',
      render: (_, record) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12 }}>
          <Text
            ellipsis={{ tooltip: record.details }}
            style={{ fontSize: 12, color: '#475569', maxWidth: 260 }}
          >
            {record.details}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<Eye size={14} color="#4F46E5" />}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTx(record);
            }}
            style={{
              backgroundColor: 'rgba(79, 70, 229, 0.06)',
              borderRadius: 6,
              color: '#4F46E5',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Inspect
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Network & Live Telemetry Banner */}
      <Card
        styles={{ body: { padding: '20px 24px' } }}
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.5)',
          color: '#FFFFFF',
          borderRadius: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <Space direction="vertical" size={4}>
            <Space size={10} align="center">
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
                  color: '#FFFFFF',
                }}
              >
                <Terminal size={18} />
              </span>
              <Title level={2} style={{ margin: 0, color: '#FFFFFF', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                Soroban Ledger Telemetry
              </Title>
              <Tag
                color="success"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: '#34D399',
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontWeight: 700,
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  className="admin-pulse-green"
                  style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', display: 'inline-block' }}
                />
                LIVE TESTNET INDEXER
              </Tag>
            </Space>
            <Paragraph style={{ margin: 0, color: '#94A3B8', fontSize: 13 }}>
              Real-time block stream, smart contract RPC receipts, and institutional financial audit trails for the Nexus lending engine.
            </Paragraph>
          </Space>

          <Space size={12} wrap>
            <Button
              type="text"
              onClick={() => setIsLiveStreaming(!isLiveStreaming)}
              style={{
                color: isLiveStreaming ? '#38BDF8' : '#94A3B8',
                backgroundColor: isLiveStreaming ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              <Radio size={14} className={isLiveStreaming ? 'admin-pulse-green' : ''} />
              {isLiveStreaming ? `Ledger #${simulatedLedger}` : 'Stream Paused'}
            </Button>

            <Button
              icon={<Download size={14} />}
              onClick={handleExportCSV}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#F8FAFC',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                fontWeight: 600,
              }}
            >
              Export CSV Audit
            </Button>

            <Button
              type="primary"
              icon={<RefreshCw size={14} className={refreshing ? 'spin' : ''} />}
              loading={refreshing}
              onClick={handleRefresh}
              style={{
                background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                fontWeight: 700,
              }}
            >
              Refresh Indexer
            </Button>
          </Space>
        </div>
      </Card>

      {/* 4-Card Executive Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="card-premium"
            styles={{ body: { padding: 20 } }}
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              borderLeft: '4px solid #4F46E5',
            }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Total Filtered Volume
                </Text>
                <span style={{ padding: 6, borderRadius: 8, background: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}>
                  <TrendingUp size={16} />
                </span>
              </div>
              <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#0F172A' }}>
                ${totalVolumeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Across {filteredTransactions.length} operations
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="card-premium"
            styles={{ body: { padding: 20 } }}
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              borderLeft: '4px solid #10B981',
            }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  On-Chain Settlement
                </Text>
                <span style={{ padding: 6, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                  <ShieldCheck size={16} />
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#0F172A' }}>
                  {verifiedCount}
                </Title>
                <Text style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>
                  ({verifiedPercentage}%)
                </Text>
              </div>
              <Progress percent={verifiedPercentage} showInfo={false} strokeColor="#10B981" size="small" />
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="card-premium"
            styles={{ body: { padding: 20 } }}
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              borderLeft: '4px solid #06B6D4',
            }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Active Counterparties
                </Text>
                <span style={{ padding: 6, borderRadius: 8, background: 'rgba(6, 182, 212, 0.1)', color: '#06B6D4' }}>
                  <Wallet size={16} />
                </span>
              </div>
              <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, color: '#0F172A' }}>
                {uniqueWallets}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Unique Stellar accounts
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="card-premium"
            styles={{ body: { padding: 20 } }}
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              borderLeft: '4px solid #EF4444',
            }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Liquidation Events
                </Text>
                <span style={{ padding: 6, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
                  <AlertTriangle size={16} />
                </span>
              </div>
              <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 800, color: liquidationCount > 0 ? '#EF4444' : '#0F172A' }}>
                {liquidationCount}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {liquidationCount > 0 ? 'Protocol safety triggers executed' : 'Zero forced liquidations'}
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Main Controls & Preset Quick Chips */}
      <Card styles={{ body: { padding: 20 } }} className="card-premium">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* Quick Preset Filter Chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Presets:
            </Text>
            {[
              { key: 'all', label: 'All Operations', icon: <ListFilter size={12} /> },
              { key: 'liquidations', label: 'Liquidations', icon: <AlertTriangle size={12} />, color: '#EF4444' },
              { key: 'repayments', label: 'Repayments', icon: <ArrowDownLeft size={12} />, color: '#10B981' },
              { key: 'loans', label: 'Loans & Borrows', icon: <Zap size={12} />, color: '#06B6D4' },
              { key: 'offers', label: 'Marketplace Offers', icon: <FileText size={12} />, color: '#F59E0B' },
              { key: 'collateral', label: 'Collateral Ops', icon: <Layers size={12} />, color: '#0EA5E9' },
              { key: 'oracle', label: 'Oracle Feed', icon: <Activity size={12} />, color: '#8B5CF6' },
              ...(wallet.address ? [{ key: 'my_wallet', label: 'My Wallet Activity', icon: <Wallet size={12} />, color: '#4F46E5' }] : []),
            ].map((preset) => {
              const active = quickPreset === preset.key;
              return (
                <Button
                  key={preset.key}
                  type={active ? 'primary' : 'default'}
                  size="small"
                  onClick={() => setQuickPreset(preset.key)}
                  style={{
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderColor: active ? undefined : '#E2E8F0',
                    color: active ? '#FFFFFF' : preset.color || '#475569',
                    backgroundColor: active ? undefined : 'rgba(241, 245, 249, 0.6)',
                  }}
                >
                  {preset.icon}
                  {preset.label}
                </Button>
              );
            })}
          </div>

          {/* Search, Dropdown Filters, and View Switcher */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              paddingTop: 12,
              borderTop: '1px dashed #E2E8F0',
            }}
          >
            <Space size={12} wrap style={{ flex: 1 }}>
              <Input
                id="tx-search-input"
                allowClear
                prefix={<Search size={14} color="#94A3B8" />}
                suffix={
                  <Text type="secondary" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: '#F1F5F9', padding: '2px 4px', borderRadius: 4 }}>
                    Ctrl+K
                  </Text>
                }
                placeholder="Search TxHash, account, contract, or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 320, borderRadius: 8 }}
              />

              <Select
                allowClear
                placeholder="Filter Action Type"
                value={selectedType}
                options={typeOptions}
                onChange={(val) => setSelectedType(val)}
                style={{ minWidth: 180 }}
              />

              <Select
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                style={{ width: 150 }}
                options={[
                  { label: 'All Statuses', value: 'all' },
                  { label: 'On-Chain Verified', value: 'verified' },
                  { label: 'Simulated Local', value: 'simulated' },
                ]}
              />

              <Select
                value={timeRange}
                onChange={(val) => setTimeRange(val)}
                style={{ width: 140 }}
                options={[
                  { label: 'All Time', value: 'all' },
                  { label: 'Past 24 Hours', value: '24h' },
                  { label: 'Past 7 Days', value: '7d' },
                  { label: 'Past 30 Days', value: '30d' },
                ]}
              />
            </Space>

            <Space size={12}>
              {/* Active Query Badges */}
              {(queryLoanId || queryOfferId || queryWallet) && (
                <Space size={4}>
                  {queryLoanId && <Tag color="blue" closable onClose={() => navigate('/app/transactions')}>Loan {shortValue(queryLoanId, 4, 4)}</Tag>}
                  {queryOfferId && <Tag color="gold" closable onClose={() => navigate('/app/transactions')}>Offer {shortValue(queryOfferId, 4, 4)}</Tag>}
                  {queryWallet && <Tag color="purple" closable onClose={() => navigate('/app/transactions')}>Wallet {shortValue(queryWallet, 4, 4)}</Tag>}
                </Space>
              )}

              {/* View Switcher: Table vs Timeline */}
              <Segmented
                value={viewMode}
                onChange={(val) => setViewMode(val as 'table' | 'timeline')}
                options={[
                  { label: 'Table Grid', value: 'table', icon: <BarChart3 size={14} /> },
                  { label: 'Timeline Stream', value: 'timeline', icon: <Layers size={14} /> },
                ]}
              />
            </Space>
          </div>
        </Space>
      </Card>

      {/* Main Transactions Display */}
      {viewMode === 'table' ? (
        <Card styles={{ body: { padding: 0 } }} className="card-premium" style={{ overflow: 'hidden' }}>
          <Table
            columns={columns}
            dataSource={filteredTransactions}
            rowKey={(record) => record.id}
            onRow={(record) => ({
              onClick: () => setSelectedTx(record),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} records`,
            }}
            scroll={{ x: 1200 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Space direction="vertical" size={4}>
                      <Text strong style={{ color: '#64748B' }}>
                        No transactions found matching your audit criteria
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setSearch('');
                          setSelectedType(undefined);
                          setQuickPreset('all');
                          setStatusFilter('all');
                          setTimeRange('all');
                        }}
                      >
                        Reset all filters
                      </Button>
                    </Space>
                  }
                />
              ),
            }}
          />
        </Card>
      ) : (
        /* Timeline Feed Stream View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredTransactions.length === 0 ? (
            <Card className="card-premium" style={{ textAlign: 'center', padding: 40 }}>
              <Empty description="No transaction events found in timeline stream." />
            </Card>
          ) : (
            filteredTransactions.map((tx) => {
              const conf = TRANSACTION_CONFIG[tx.type] || {
                label: formatActionLabel(tx.type),
                color: '#4F46E5',
                bg: 'rgba(79, 70, 229, 0.08)',
                border: 'rgba(79, 70, 229, 0.2)',
                icon: <Activity size={16} />,
              };
              const isMyTx = wallet.address && tx.user === wallet.address;

              return (
                <Card
                  key={tx.id}
                  className="card-premium"
                  onClick={() => setSelectedTx(tx)}
                  styles={{ body: { padding: 20 } }}
                  style={{
                    borderLeft: `4px solid ${conf.color}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <Space size={14} align="start">
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 12,
                          backgroundColor: conf.bg,
                          border: `1px solid ${conf.border}`,
                          color: conf.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {conf.icon}
                      </div>

                      <Space direction="vertical" size={2}>
                        <Space size={8}>
                          <Text strong style={{ fontSize: 16, fontFamily: 'var(--font-heading)', color: '#0F172A' }}>
                            {conf.label}
                          </Text>
                          {tx.txHash ? (
                            <Tag color="success" style={{ margin: 0, fontSize: 10 }}>
                              ON-CHAIN
                            </Tag>
                          ) : (
                            <Tag style={{ margin: 0, fontSize: 10 }}>SIMULATED</Tag>
                          )}
                          {isMyTx && <Tag color="indigo" style={{ margin: 0, fontSize: 10 }}>YOU</Tag>}
                        </Space>

                        <Text style={{ fontSize: 13, color: '#475569' }}>{tx.details}</Text>

                        <Space size={16} style={{ marginTop: 6, fontSize: 12, color: '#64748B' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            User: <strong>{shortValue(tx.user)}</strong>
                          </span>
                          {tx.ledger && (
                            <span style={{ fontFamily: 'var(--font-mono)' }}>
                              Ledger: <strong>#{tx.ledger}</strong>
                            </span>
                          )}
                        </Space>
                      </Space>
                    </Space>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <Text strong style={{ fontSize: 18, fontFamily: 'var(--font-heading)', color: '#0F172A' }}>
                        {formatCurrency(tx.amount, tx.asset)}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {formatTime(tx.timestamp)} ({getTimeAgo(tx.timestamp)})
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        icon={<ChevronRight size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTx(tx);
                        }}
                        style={{ padding: 0, height: 'auto', fontWeight: 600, marginTop: 4 }}
                      >
                        View Audit Payload
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Institutional Audit & Inspection Drawer */}
      <Drawer
        title={
          <Space align="center" size={10}>
            <Terminal size={18} color="#4F46E5" />
            <Text strong style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>
              Soroban Transaction Audit Inspector
            </Text>
          </Space>
        }
        placement="right"
        width={560}
        onClose={() => setSelectedTx(null)}
        open={!!selectedTx}
        styles={{ body: { padding: 24 } }}
      >
        {selectedTx && (
          <Space direction="vertical" size={20} style={{ width: '100%' }}>
            {/* Header Action Tag */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                backgroundColor: TRANSACTION_CONFIG[selectedTx.type]?.bg || '#F8FAFC',
                border: `1px solid ${TRANSACTION_CONFIG[selectedTx.type]?.border || '#E2E8F0'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Space size={10}>
                {TRANSACTION_CONFIG[selectedTx.type]?.icon}
                <Text strong style={{ fontSize: 16, color: TRANSACTION_CONFIG[selectedTx.type]?.color || '#0F172A' }}>
                  {TRANSACTION_CONFIG[selectedTx.type]?.label || selectedTx.type}
                </Text>
              </Space>
              <Tag color={selectedTx.txHash ? 'green' : 'default'} style={{ margin: 0, fontWeight: 700 }}>
                {selectedTx.txHash ? 'VERIFIED ON-CHAIN' : 'SIMULATED LOCAL'}
              </Tag>
            </div>

            {/* Financial Summary Box */}
            <Card styles={{ body: { padding: 16 } }} style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    Amount
                  </Text>
                  <Title level={4} style={{ margin: 0, color: '#0F172A' }}>
                    {formatCurrency(selectedTx.amount, selectedTx.asset)}
                  </Title>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                    Asset Code
                  </Text>
                  <Title level={4} style={{ margin: 0, color: '#0F172A' }}>
                    {selectedTx.asset}
                  </Title>
                </Col>
              </Row>
            </Card>

            {/* General Metadata Section */}
            <div>
              <Title level={5} style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
                Transaction Metadata
              </Title>
              <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text type="secondary">Internal ID:</Text>
                  <Text style={{ fontFamily: 'var(--font-mono)' }}>{selectedTx.id}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text type="secondary">Initiator Account:</Text>
                  <Space size={4}>
                    <Text copyable={{ text: selectedTx.user }} style={{ fontFamily: 'var(--font-mono)' }}>
                      {shortValue(selectedTx.user, 8, 8)}
                    </Text>
                  </Space>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text type="secondary">Timestamp:</Text>
                  <Text>{formatTime(selectedTx.timestamp)}</Text>
                </div>
                {selectedTx.loanId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <Text type="secondary">Linked Loan ID:</Text>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setSelectedTx(null);
                        navigate(`/app/loans/${selectedTx.loanId}`);
                      }}
                      style={{ padding: 0, height: 'auto', fontFamily: 'var(--font-mono)' }}
                    >
                      {selectedTx.loanId}
                    </Button>
                  </div>
                )}
                {selectedTx.offerId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <Text type="secondary">Linked Offer ID:</Text>
                    <Text style={{ fontFamily: 'var(--font-mono)' }}>{selectedTx.offerId}</Text>
                  </div>
                )}
              </Space>
            </div>

            {/* On-Chain Ledger Proof Section */}
            <div>
              <Title level={5} style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
                On-Chain Proof & Soroban Receipt
              </Title>
              <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <Text type="secondary">TxHash Receipt:</Text>
                  {selectedTx.txHash ? (
                    <a
                      href={selectedTx.explorerUrl || `https://stellar.expert/explorer/testnet/tx/${selectedTx.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                    >
                      {shortValue(selectedTx.txHash, 6, 6)} <ExternalLink size={12} />
                    </a>
                  ) : (
                    <Text type="secondary">Not submitted to Stellar RPC</Text>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text type="secondary">Contract Address:</Text>
                  <Text style={{ fontFamily: 'var(--font-mono)' }}>
                    {selectedTx.contract ? shortValue(selectedTx.contract, 8, 8) : '0xNexusLendingContract'}
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text type="secondary">Ledger Index:</Text>
                  <Text style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    #{selectedTx.ledger || simulatedLedger}
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Text type="secondary">Gas Fee (Stroops):</Text>
                  <Text style={{ fontFamily: 'var(--font-mono)' }}>14,210 Stroops (~0.00142 XLM)</Text>
                </div>
              </Space>
            </div>

            {/* Action Details Note */}
            <div>
              <Title level={5} style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
                Execution Details & Logs
              </Title>
              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: '#F1F5F9',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: '#334155',
                  lineHeight: 1.6,
                }}
              >
                {selectedTx.details}
              </div>
            </div>

            {/* Developer Raw JSON Tree */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
                  Raw RPC Payload
                </Title>
                <Button
                  type="text"
                  size="small"
                  icon={<Copy size={12} />}
                  onClick={() => handleCopy(JSON.stringify(selectedTx, null, 2), 'raw-json')}
                >
                  Copy JSON
                </Button>
              </div>
              <pre
                style={{
                  backgroundColor: '#0F172A',
                  color: '#38BDF8',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  overflowX: 'auto',
                  maxHeight: 200,
                }}
              >
                {JSON.stringify(selectedTx, null, 2)}
              </pre>
            </div>

            {/* Footer Action Buttons */}
            {selectedTx.txHash && (
              <Button
                type="primary"
                block
                icon={<ExternalLink size={14} />}
                onClick={() =>
                  window.open(selectedTx.explorerUrl || `https://stellar.expert/explorer/testnet/tx/${selectedTx.txHash}`, '_blank')
                }
                style={{ marginTop: 12 }}
              >
                Open in Stellar Expert Explorer
              </Button>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};
