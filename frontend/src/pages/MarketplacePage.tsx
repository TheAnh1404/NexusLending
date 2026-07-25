import React, { useState, useEffect } from 'react';
import { Typography, Input, Select, Button, Row, Col, Card, Table, Tag, Space } from 'antd';
import { Search, PlusCircle, ArrowRight, Clock } from 'lucide-react';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { CHAIN_MODE } from '../services/api/client';
import { offersApi } from '../services/api/offers.api';
import { calculateRequiredCollateral, formatAddress } from '../utils/finance';
import { getConnectedWalletAddress, isSameWalletAddress } from '../utils/wallet';
import { EmptyState } from '../components/common/CommonStates';
import { BorrowWizardDrawer } from '../components/common/BorrowWizardDrawer';
import { CreateOfferWizardDrawer } from '../components/common/CreateOfferWizardDrawer';
import { MarketplaceBanner } from '../components/marketplace/MarketplaceBanner';
import type { LoanOffer } from '../types';

const { Title, Text } = Typography;
const MARKETPLACE_CHAIN_SYNC_INTERVAL_MS = 10_000;

const formatTokenAmount = (value: number, asset: string) => {
  const assetSymbol = asset.toUpperCase();
  const fractionDigits = assetSymbol === 'USDC' ? 2 : 4;

  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits,
  }).format(value)} ${assetSymbol}`;
};

const getTokenIconStyle = (asset: string): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  backgroundColor: asset.toUpperCase() === 'USDC' ? '#2775ca' : '#14b8a6',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: 0,
  flex: '0 0 32px',
});

export const MarketplacePage: React.FC = () => {
  const { loanOffers, loans, oraclePrices, wallet, refreshData } = useAppContext();
  const { publicKey } = useWallet();
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [durationFilter, setDurationFilter] = useState<number | 'ALL'>('ALL');
  const [aprSort, setAprSort] = useState<'ASC' | 'DESC'>('ASC');

  // Drawers
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [borrowDrawerOpen, setBorrowDrawerOpen] = useState(false);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  const activeChainOfferIds = React.useMemo(
    () => loanOffers
      .filter((offer) => offer.status === 'Active' && offer.contractOfferId !== undefined)
      .map((offer) => offer.id),
    [loanOffers]
  );
  const activeChainOfferIdsKey = activeChainOfferIds.join('|');

  useEffect(() => {
    if (CHAIN_MODE === 'mock' || !connectedWalletAddress || activeChainOfferIds.length === 0) return;

    let cancelled = false;
    const syncActiveOffers = async () => {
      const ids = activeChainOfferIdsKey.split('|').filter(Boolean);
      if (ids.length === 0) return;

      const results = await Promise.allSettled(
        ids.map((offerId) => offersApi.syncChain(offerId, connectedWalletAddress))
      );
      const changed = results.some((result) =>
        result.status === 'fulfilled' && result.value.status !== 'Active'
      );
      if (changed && !cancelled) {
        await refreshData();
      }
    };

    void syncActiveOffers();
    const intervalId = window.setInterval(() => {
      void syncActiveOffers();
    }, MARKETPLACE_CHAIN_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeChainOfferIds.length, activeChainOfferIdsKey, connectedWalletAddress, refreshData]);

  // Filter loan offers dynamically
  const filteredOffers = loanOffers
    .filter((offer) => {
      const matchesSearch =
        offer.id.toLowerCase().includes(search.toLowerCase()) ||
        offer.lender.toLowerCase().includes(search.toLowerCase());
      const isListed = offer.status === 'Active';
      const isAcceptableOnChain = CHAIN_MODE === 'mock' || offer.contractOfferId !== undefined;
      const matchesAsset = assetFilter === 'ALL' || offer.asset === assetFilter;
      const matchesDuration = durationFilter === 'ALL' || offer.duration <= (durationFilter as number);

      return isListed && isAcceptableOnChain && matchesSearch && matchesAsset && matchesDuration;
    })
    .sort((a, b) => (aprSort === 'ASC' ? a.apr - b.apr : b.apr - a.apr));

  // Summary stats
  const availableOffersCount = filteredOffers.length;
  const activeLoansCount = loans.filter((l) => l.status === 'Active').length;
  const avgApr =
    filteredOffers.length > 0
      ? (filteredOffers.reduce((sum, o) => sum + o.apr, 0) / filteredOffers.length).toFixed(1)
      : '0.0';

  const handleSelectOffer = (offer: LoanOffer) => {
    setSelectedOffer(offer);
    setBorrowDrawerOpen(true);
  };

  // Offer Table List Columns
  const columns = [
    {
      title: 'Borrow Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number, record: LoanOffer) => (
        <Space size={10} align="center">
          <div style={getTokenIconStyle(record.asset)} aria-label={`${record.asset.toUpperCase()} token`}>
            {record.asset.toUpperCase() === 'USDC' ? '$' : record.asset.slice(0, 1).toUpperCase()}
          </div>
          <Text strong style={{ fontSize: 16, color: 'var(--text-main)' }}>
            {formatTokenAmount(val, record.asset)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Lender Wallet',
      dataIndex: 'lender',
      key: 'lender',
      render: (lender: string) => {
        const isOwner = isSameWalletAddress(lender, connectedWalletAddress);
        return (
          <Space size={6}>
            <Text
              code
              copyable={{ text: lender }}
              style={{ fontSize: 12, borderRadius: 6, margin: 0 }}
            >
              {formatAddress(lender)}
            </Text>
            {isOwner && (
              <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 6px', borderRadius: 4, fontWeight: 700 }}>
                You
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Fixed APR',
      dataIndex: 'apr',
      key: 'apr',
      render: (val: number) => (
        <Tag color="purple" style={{ borderRadius: 4, fontWeight: 700, fontSize: 13, padding: '2px 8px' }}>
          {val}% APR
        </Tag>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (val: number) => (
        <Space size={4}>
          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
          <Text strong>{val} Days</Text>
        </Space>
      ),
    },
    {
      title: 'Required Collateral',
      dataIndex: 'maxLTV',
      key: 'requiredCollateral',
      render: (_: unknown, record: LoanOffer) => {
        const req = calculateRequiredCollateral(record.amount, 1.0, xlmPrice, record.maxLTV);
        return (
          <div>
            <Text strong>{Math.ceil(req).toLocaleString()} {record.collateralAsset}</Text>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              ${(Math.ceil(req) * xlmPrice).toFixed(2)} USD
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status?: string) => (
        <Tag color="green" style={{ borderRadius: 4, fontWeight: 600 }}>
          {status || 'Active'}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right' as const,
      render: (_: unknown, record: LoanOffer) => {
        const isOwner = isSameWalletAddress(record.lender, connectedWalletAddress);
        return (
          <Button
            type="primary"
            onClick={() => handleSelectOffer(record)}
            style={{ borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <span>{isOwner ? 'Manage Offer' : 'Borrow Now'}</span>
            <ArrowRight size={14} />
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Premium Hero Promotional Banner */}
      <MarketplaceBanner onCreateOffer={() => setCreateDrawerOpen(true)} />

      {/* Top Summary Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8}>
          <Card className="card-premium" styles={{ body: { padding: '16px' } }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Available Offers</Text>
            <Title level={3} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{availableOffersCount}</Title>
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="card-premium" styles={{ body: { padding: '16px' } }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Active Protocol Loans</Text>
            <Title level={3} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>{activeLoansCount}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="card-premium" styles={{ body: { padding: '16px' } }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Average APR</Text>
            <Title level={3} style={{ margin: '4px 0 0 0', fontWeight: 800, color: 'var(--primary-color)' }}>{avgApr}%</Title>
          </Card>
        </Col>
      </Row>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--border-color, #e2e8f0)',
        }}
      >
        <Input
          placeholder="Search offer ID or lender address..."
          prefix={<Search size={16} style={{ color: 'var(--text-muted)' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, borderRadius: 8 }}
          allowClear
        />

        <Select
          value={assetFilter}
          onChange={setAssetFilter}
          style={{ width: 130 }}
          options={[
            { value: 'ALL', label: 'All Assets' },
            { value: 'USDC', label: 'USDC' },
            { value: 'XLM', label: 'XLM' },
          ]}
        />

        <Select
          value={durationFilter}
          onChange={setDurationFilter}
          style={{ width: 140 }}
          options={[
            { value: 'ALL', label: 'All Durations' },
            { value: 30, label: '<= 30 Days' },
            { value: 60, label: '<= 60 Days' },
            { value: 90, label: '<= 90 Days' },
          ]}
        />

        <Select
          value={aprSort}
          onChange={setAprSort}
          style={{ width: 140 }}
          options={[
            { value: 'ASC', label: 'Lowest APR' },
            { value: 'DESC', label: 'Highest APR' },
          ]}
        />
      </div>

      {/* Offer List Table */}
      {filteredOffers.length === 0 ? (
        <EmptyState
          title="No offers found"
          description="Try changing your filters or create a new lending offer."
          action={
            <Button type="primary" icon={<PlusCircle size={16} />} onClick={() => setCreateDrawerOpen(true)}>
              Create First Offer
            </Button>
          }
        />
      ) : (
        <Card className="card-premium" styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={filteredOffers}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {/* Drawers */}
      <CreateOfferWizardDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        onSuccess={() => {
          setCreateDrawerOpen(false);
          refreshData();
        }}
      />

      <BorrowWizardDrawer
        open={borrowDrawerOpen}
        offer={selectedOffer}
        onClose={() => setBorrowDrawerOpen(false)}
        onSuccess={() => {
          setBorrowDrawerOpen(false);
          refreshData();
        }}
      />
    </div>
  );
};
