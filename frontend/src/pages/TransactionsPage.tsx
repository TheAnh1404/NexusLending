import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRight, ExternalLink, FileText, RefreshCw, Search } from 'lucide-react';

import { useAppContext } from '../app/AppContext';
import type { Transaction, TransactionType } from '../types';
import { formatCurrency } from '../utils/finance';

const { Title, Text, Paragraph } = Typography;

const transactionTypeColors: Partial<Record<TransactionType, string>> = {
  CREATE_OFFER: 'gold',
  FUND_OFFER: 'gold',
  ACTIVATE_OFFER: 'green',
  CANCEL_OFFER: 'default',
  EXPIRE_OFFER: 'default',
  ACCEPT_OFFER: 'blue',
  ACTIVATE_LOAN: 'cyan',
  ADD_COLLATERAL: 'cyan',
  PARTIAL_REPAY: 'green',
  FULL_REPAY: 'green',
  UPDATE_ORACLE: 'purple',
  LIQUIDATE: 'red',
};

const shortValue = (value?: string): string => {
  if (!value) return '-';
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
};

const formatAction = (type: string): string => type.replace(/_/g, ' ');

const formatTime = (timestamp?: string): string => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
};

const matchesSearch = (transaction: Transaction, search: string): boolean => {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return true;
  return [
    transaction.type,
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
  const { transactions, refreshData } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryLoanId = query.get('loanId') ?? '';
  const queryOfferId = query.get('offerId') ?? '';
  const queryWallet = query.get('wallet') ?? '';
  const queryType = query.get('type') ?? undefined;
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string | undefined>(queryType);
  const [refreshing, setRefreshing] = useState(false);

  const typeOptions = useMemo(
    () => Array.from(new Set(transactions.map((transaction) => transaction.type)))
      .sort()
      .map((type) => ({ label: formatAction(type), value: type })),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => !queryLoanId || transaction.loanId === queryLoanId)
      .filter((transaction) => !queryOfferId || transaction.offerId === queryOfferId)
      .filter((transaction) => !queryWallet || transaction.user === queryWallet)
      .filter((transaction) => !selectedType || transaction.type === selectedType)
      .filter((transaction) => matchesSearch(transaction, search))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [queryLoanId, queryOfferId, queryWallet, search, selectedType, transactions]);

  const verifiedCount = filteredTransactions.filter((transaction) => transaction.txHash).length;
  const uniqueWallets = new Set(filteredTransactions.map((transaction) => transaction.user).filter(Boolean)).size;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const columns: ColumnsType<Transaction> = [
    {
      title: 'Action',
      dataIndex: 'type',
      key: 'type',
      width: 170,
      render: (type: TransactionType) => (
        <Tag color={transactionTypeColors[type] ?? 'default'} style={{ fontWeight: 700, margin: 0 }}>
          {formatAction(type)}
        </Tag>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 140,
      render: (_, record) => (
        <Text strong>{formatCurrency(record.amount, record.asset)}</Text>
      ),
    },
    {
      title: 'Wallet',
      dataIndex: 'user',
      key: 'user',
      width: 170,
      render: (user: string) => (
        <Text copyable={{ text: user }} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {shortValue(user)}
        </Text>
      ),
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 210,
      render: (_, record) => {
        const entityId = record.loanId ?? record.offerId;
        if (!entityId) return <Text type="secondary">-</Text>;
        return (
          <Space size={4} wrap>
            {record.loanId && <Tag color="blue" style={{ margin: 0 }}>Loan</Tag>}
            {!record.loanId && record.offerId && <Tag color="gold" style={{ margin: 0 }}>Offer</Tag>}
            <Button
              type="link"
              size="small"
              icon={<ArrowRight size={12} />}
              onClick={() => navigate(`/app/loans/${entityId}`)}
              style={{ padding: 0, height: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12 }}
            >
              {shortValue(entityId)}
            </Button>
          </Space>
        );
      },
    },
    {
      title: 'Contract',
      dataIndex: 'contract',
      key: 'contract',
      width: 160,
      render: (contract?: string) => contract ? (
        <Text copyable={{ text: contract }} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {shortValue(contract)}
        </Text>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: 'Ledger',
      dataIndex: 'ledger',
      key: 'ledger',
      width: 110,
      render: (ledger?: number) => ledger ? (
        <Text style={{ fontFamily: 'var(--font-mono)' }}>#{ledger}</Text>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: 'Receipt',
      dataIndex: 'txHash',
      key: 'txHash',
      width: 180,
      render: (txHash?: string, record?: Transaction) => {
        if (!txHash) return <Text type="secondary">Local record</Text>;
        return (
          <a
            href={record?.explorerUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 12 }}
          >
            {shortValue(txHash)} <ExternalLink size={12} />
          </a>
        );
      },
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp?: string, record?: Transaction) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{formatTime(record?.blockTimestamp ?? timestamp)}</Text>
          {record?.blockTimestamp && (
            <Text type="secondary" style={{ fontSize: 11 }}>Block timestamp</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (details: string) => <Text style={{ fontSize: 12 }}>{details}</Text>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Transaction History
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Ledger receipts, backend-verified actions, and local mock records for the connected Nexus workspace.
          </Paragraph>
        </div>
        <Button type="primary" icon={<RefreshCw size={14} />} loading={refreshing} onClick={handleRefresh}>
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Filtered Records" value={filteredTransactions.length} prefix={<FileText size={18} />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Verified Receipts" value={verifiedCount} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Wallets" value={uniqueWallets} />
          </Card>
        </Col>
      </Row>

      <Card styles={{ body: { padding: 16 } }}>
        <Space size="middle" wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space size="middle" wrap>
            <Input
              allowClear
              prefix={<Search size={14} />}
              placeholder="Search hash, wallet, contract, or details"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ width: 320 }}
            />
            <Select
              allowClear
              placeholder="Action type"
              value={selectedType}
              options={typeOptions}
              onChange={(value) => setSelectedType(value)}
              style={{ minWidth: 220 }}
            />
          </Space>
          <Space size={8} wrap>
            {queryLoanId && <Tag color="blue">Loan {shortValue(queryLoanId)}</Tag>}
            {queryOfferId && <Tag color="gold">Offer {shortValue(queryOfferId)}</Tag>}
            {queryWallet && <Tag color="purple">Wallet {shortValue(queryWallet)}</Tag>}
          </Space>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredTransactions}
          rowKey={(record) => record.id}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1320 }}
        />
      </Card>
    </div>
  );
};
