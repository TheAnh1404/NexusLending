import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Typography, Input, Select, Button, Row, Col, Card, Table, Tag, Space, Tabs, Tooltip, Badge, Slider } from 'antd';
import { Search, PlusCircle, ArrowRight, Clock, Coins, Percent, TrendingUp, Star, UserCheck, Zap, DollarSign } from 'lucide-react';
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
import { OfferIdBadge } from '../components/common/OfferIdBadge';
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
  borderRadius: '8px',
  background: asset.toUpperCase() === 'USDC' 
    ? 'linear-gradient(135deg, #2775ca 0%, #1e5ba8 100%)' 
    : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: 13,
  boxShadow: asset.toUpperCase() === 'USDC'
    ? '0 3px 8px rgba(39, 117, 202, 0.25)'
    : '0 3px 8px rgba(20, 184, 166, 0.25)',
  flex: '0 0 32px',
});

interface AmountTierGroup {
  amount: number;
  asset: string;
  offers: LoanOffer[];
  bestApr: number;
}

export const MarketplacePage: React.FC = () => {
  const { loanOffers, oraclePrices, wallet, refreshData } = useAppContext();

  const { publicKey } = useWallet();
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);

  // Tab & Filters State
  const [activeTab, setActiveTab] = useState<'market' | 'my_offers'>('market');
  const [search, setSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [durationFilter, setDurationFilter] = useState<number | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'BEST_APR' | 'HIGHEST_APR' | 'SHORTEST_DURATION'>('BEST_APR');

  // Drawers State
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [borrowDrawerOpen, setBorrowDrawerOpen] = useState(false);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  const activeChainOfferIds = useMemo(
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

  // Separate Offers: Marketplace vs User's Own Offers
  const allActiveOffers = useMemo(() => {
    return loanOffers.filter((offer) => {
      const isListed = offer.status === 'Active';
      const isAcceptableOnChain = CHAIN_MODE === 'mock' || offer.contractOfferId !== undefined;
      return isListed && isAcceptableOnChain;
    });
  }, [loanOffers]);

  // Min and Max available offer amounts for Slider
  const minAvailableAmount = useMemo(() => {
    if (allActiveOffers.length === 0) return 100;
    return Math.min(...allActiveOffers.map((o) => o.amount));
  }, [allActiveOffers]);

  const maxAvailableAmount = useMemo(() => {
    if (allActiveOffers.length === 0) return 10000;
    return Math.max(...allActiveOffers.map((o) => o.amount));
  }, [allActiveOffers]);

  // Amount Range Slider State
  const [amountRange, setAmountRange] = useState<[number, number]>([100, 10000]);

  useEffect(() => {
    setAmountRange([minAvailableAmount, maxAvailableAmount]);
  }, [minAvailableAmount, maxAvailableAmount]);

  // My Listed Offers (Created by connected user)
  const myListedOffers = useMemo(() => {
    if (!connectedWalletAddress) return [];
    return allActiveOffers.filter((o) => isSameWalletAddress(o.lender, connectedWalletAddress));
  }, [allActiveOffers, connectedWalletAddress]);

  // Marketplace Offers (ALL active offers available across the protocol)
  const marketplaceOffers = allActiveOffers;

  // Filter & Sort Callback Helper
  const processFilter = useCallback((offersList: LoanOffer[]) => {
    const query = search.trim().toLowerCase();

    return offersList.filter((offer) => {
      const matchesSearch =
        !query ||
        offer.id.toLowerCase().includes(query) ||
        offer.lender.toLowerCase().includes(query);
      const matchesAsset = assetFilter === 'ALL' || offer.asset === assetFilter;
      const matchesDuration = durationFilter === 'ALL' || offer.duration <= (durationFilter as number);
      const matchesAmountRange = offer.amount >= amountRange[0] && offer.amount <= amountRange[1];

      return matchesSearch && matchesAsset && matchesDuration && matchesAmountRange;
    });
  }, [search, assetFilter, durationFilter, amountRange]);

  const filteredMarketOffers = useMemo(() => processFilter(marketplaceOffers), [marketplaceOffers, processFilter]);
  const filteredMyOffers = useMemo(() => processFilter(myListedOffers), [myListedOffers, processFilter]);

  // Group Market Offers by Amount Tier and Sort Tiers & Offers
  const groupedMarketTiers = useMemo<AmountTierGroup[]>(() => {
    const groupsMap = new Map<number, LoanOffer[]>();

    for (const offer of filteredMarketOffers) {
      const existing = groupsMap.get(offer.amount) || [];
      existing.push(offer);
      groupsMap.set(offer.amount, existing);
    }

    const tiers: AmountTierGroup[] = [];
    groupsMap.forEach((offersInGroup, amount) => {
      // Sort offers inside group by selected sort criteria
      const sortedOffers = [...offersInGroup].sort((a, b) => {
        if (sortBy === 'BEST_APR') return a.apr - b.apr;
        if (sortBy === 'HIGHEST_APR') return b.apr - a.apr;
        if (sortBy === 'SHORTEST_DURATION') return a.duration - b.duration;
        return a.apr - b.apr;
      });

      const bestApr = Math.min(...sortedOffers.map((o) => o.apr));

      tiers.push({
        amount,
        asset: sortedOffers[0]?.asset || 'USDC',
        offers: sortedOffers,
        bestApr,
      });
    });

    // Sort groups by amount tier ascending ($100 -> $200 -> $500 -> $1000)
    return tiers.sort((a, b) => a.amount - b.amount);
  }, [filteredMarketOffers, sortBy]);

  // Group My Offers by Amount Tier
  const groupedMyTiers = useMemo<AmountTierGroup[]>(() => {
    const groupsMap = new Map<number, LoanOffer[]>();

    for (const offer of filteredMyOffers) {
      const existing = groupsMap.get(offer.amount) || [];
      existing.push(offer);
      groupsMap.set(offer.amount, existing);
    }

    const tiers: AmountTierGroup[] = [];
    groupsMap.forEach((offersInGroup, amount) => {
      const sortedOffers = [...offersInGroup].sort((a, b) => a.apr - b.apr);
      const bestApr = Math.min(...sortedOffers.map((o) => o.apr));

      tiers.push({
        amount,
        asset: sortedOffers[0]?.asset || 'USDC',
        offers: sortedOffers,
        bestApr,
      });
    });

    return tiers.sort((a, b) => a.amount - b.amount);
  }, [filteredMyOffers]);

  // Calculate Overall Best APR minimum among market offers
  const minMarketApr = useMemo(() => {
    if (filteredMarketOffers.length === 0) return null;
    return Math.min(...filteredMarketOffers.map((o) => o.apr));
  }, [filteredMarketOffers]);

  // Summary statistics
  const avgApr =
    filteredMarketOffers.length > 0
      ? (filteredMarketOffers.reduce((sum, o) => sum + o.apr, 0) / filteredMarketOffers.length).toFixed(1)
      : '0.0';

  const handleSelectOffer = (offer: LoanOffer) => {
    setSelectedOffer(offer);
    setBorrowDrawerOpen(true);
  };

  // Table List Column Definitions for each Tier Group
  const createTableColumns = (bestAprInTier: number, isMyOffersTab = false) => [
    {
      title: 'Offer ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: LoanOffer) => {
        const isBestInTier = record.apr === bestAprInTier && !isMyOffersTab;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', whiteSpace: 'nowrap' }}>
            <OfferIdBadge id={id} size="small" />
            {isBestInTier && (
              <Tag
                color="green"
                icon={<Star size={10} fill="#10b981" style={{ marginRight: 2 }} />}
                style={{
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 10,
                  padding: '1px 6px',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#059669',
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                BEST IN TIER
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Borrow Principal',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number, record: LoanOffer) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <div style={getTokenIconStyle(record.asset)} aria-label={`${record.asset.toUpperCase()} token`}>
            {record.asset.toUpperCase() === 'USDC' ? '$' : record.asset.slice(0, 1).toUpperCase()}
          </div>
          <Text strong style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {formatTokenAmount(val, record.asset)}
          </Text>
        </div>
      ),
    },
    {
      title: 'APR / Duration',
      key: 'aprDuration',
      render: (_: unknown, record: LoanOffer) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, whiteSpace: 'nowrap' }}>
          <Tag
            color="purple"
            style={{
              borderRadius: 6,
              fontWeight: 800,
              fontSize: 12,
              padding: '2px 8px',
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              color: '#7c3aed',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              margin: 0,
              width: 'fit-content',
              whiteSpace: 'nowrap',
            }}
          >
            {record.apr}% APR
          </Tag>
          <Space size={4} style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <Clock size={12} />
            <span>{record.duration} Days</span>
          </Space>
        </div>
      ),
    },
    {
      title: 'Required Collateral',
      dataIndex: 'maxLTV',
      key: 'requiredCollateral',
      render: (_: unknown, record: LoanOffer) => {
        const req = calculateRequiredCollateral(record.amount, 1.0, xlmPrice, record.maxLTV);
        return (
          <div style={{ whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                {Math.ceil(req).toLocaleString()} {record.collateralAsset}
              </Text>
              <Tag color="blue" style={{ borderRadius: 4, fontWeight: 700, fontSize: 10, margin: 0, padding: '0 5px', whiteSpace: 'nowrap' }}>
                {record.maxLTV}% LTV
              </Tag>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap' }}>
              ~${(Math.ceil(req) * xlmPrice).toFixed(2)} USD
            </div>
          </div>
        );
      },
    },
    {
      title: 'Lender Wallet',
      dataIndex: 'lender',
      key: 'lender',
      render: (lender: string) => {
        const isOwner = isSameWalletAddress(lender, connectedWalletAddress);
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <Tooltip title={lender}>
              <Text code style={{ fontSize: 11, borderRadius: 6, margin: 0, padding: '2px 6px', whiteSpace: 'nowrap', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                {formatAddress(lender)}
              </Text>
            </Tooltip>
            {isOwner && (
              <Tag color="cyan" style={{ fontSize: 9, margin: 0, padding: '0 4px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>
                YOU
              </Tag>
            )}
          </div>
        );
      },
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
            style={{
              borderRadius: 8,
              fontWeight: 700,
              height: 36,
              padding: '0 14px',
              fontSize: 13,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              boxShadow: isOwner ? undefined : '0 3px 10px rgba(37, 99, 235, 0.2)',
            }}
          >
            <span>{isOwner ? 'Manage' : 'Borrow Now'}</span>
            <ArrowRight size={13} />
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: '100%', minWidth: 0 }}>
      {/* Hero Promotional Banner */}
      <MarketplaceBanner onCreateOffer={() => setCreateDrawerOpen(true)} />

      {/* Top Metrics Stat Grid */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card
            className="card-premium"
            styles={{ body: { padding: '18px 20px' } }}
            style={{
              borderRadius: 16,
              border: '1px solid rgba(226, 232, 240, 0.8)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Open Market Offers
              </Text>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Coins size={18} />
              </div>
            </div>
            <Title level={3} style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
              {marketplaceOffers.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>offers</span>
            </Title>
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            className="card-premium"
            styles={{ body: { padding: '18px 20px' } }}
            style={{
              borderRadius: 16,
              border: '1px solid rgba(226, 232, 240, 0.8)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                My Listed Offers
              </Text>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={18} />
              </div>
            </div>
            <Title level={3} style={{ margin: 0, fontWeight: 800, color: '#10b981' }}>
              {myListedOffers.length} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>my offers</span>
            </Title>
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            className="card-premium"
            styles={{ body: { padding: '18px 20px' } }}
            style={{
              borderRadius: 16,
              border: '1px solid rgba(226, 232, 240, 0.8)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Best Market APR
              </Text>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Percent size={18} />
              </div>
            </div>
            <Title level={3} style={{ margin: 0, fontWeight: 800, color: '#8b5cf6' }}>
              {minMarketApr !== null ? `${minMarketApr}%` : `${avgApr}%`}
            </Title>
          </Card>
        </Col>

        <Col xs={12} sm={6}>
          <Card
            className="card-premium"
            styles={{ body: { padding: '18px 20px' } }}
            style={{
              borderRadius: 16,
              border: '1px solid rgba(226, 232, 240, 0.8)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                XLM Collateral Price
              </Text>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <Title level={3} style={{ margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
              ${xlmPrice.toFixed(4)}
            </Title>
          </Card>
        </Col>
      </Row>

      {/* Primary Section Header: Tabs Separating Open Marketplace vs User's Own Offers */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 16, border: '1px solid var(--border-color, #e2e8f0)', padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as 'market' | 'my_offers')}
            style={{ margin: 0 }}
            items={[
              {
                key: 'market',
                label: (
                  <Space size={8} style={{ fontSize: 15, fontWeight: 700, padding: '4px 8px' }}>
                    <Zap size={18} style={{ color: '#2563eb' }} />
                    <span>Open Marketplace</span>
                    <Badge count={filteredMarketOffers.length} overflowCount={99} style={{ backgroundColor: '#2563eb' }} />
                  </Space>
                ),
              },
              {
                key: 'my_offers',
                label: (
                  <Space size={8} style={{ fontSize: 15, fontWeight: 700, padding: '4px 8px' }}>
                    <UserCheck size={18} style={{ color: '#10b981' }} />
                    <span>My Listed Offers</span>
                    <Badge count={filteredMyOffers.length} overflowCount={99} style={{ backgroundColor: '#10b981' }} />
                  </Space>
                ),
              },
            ]}
          />

          <Button
            type="primary"
            icon={<PlusCircle size={16} />}
            onClick={() => setCreateDrawerOpen(true)}
            style={{ borderRadius: 10, fontWeight: 700, height: 42, padding: '0 20px' }}
          >
            Create New Offer
          </Button>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="Search Offer ID (e.g. OFFER-101) or Lender Wallet..."
            prefix={<Search size={16} style={{ color: 'var(--text-muted)', marginRight: 4 }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 220px', borderRadius: 10, padding: '8px 12px' }}
            allowClear
          />

          <Select
            value={assetFilter}
            onChange={setAssetFilter}
            style={{ width: 120 }}
            options={[
              { value: 'ALL', label: 'All Assets' },
              { value: 'USDC', label: 'USDC' },
              { value: 'XLM', label: 'XLM' },
            ]}
          />

          {/* Amount Tier Range Slider */}
          <div style={{ flex: '1 1 280px', minWidth: 260, backgroundColor: 'rgba(248, 250, 252, 0.9)', padding: '6px 16px 4px 16px', borderRadius: 10, border: '1px solid rgba(226, 232, 240, 0.9)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Amount Range: <span style={{ color: '#2563eb', fontWeight: 800 }}>${amountRange[0]} - ${amountRange[1]} USDC</span>
              </Text>
              {(amountRange[0] !== minAvailableAmount || amountRange[1] !== maxAvailableAmount) && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setAmountRange([minAvailableAmount, maxAvailableAmount])}
                  style={{ padding: 0, fontSize: 10, height: 'auto', fontWeight: 600 }}
                >
                  Reset Range
                </Button>
              )}
            </div>
            <Slider
              range
              min={minAvailableAmount}
              max={maxAvailableAmount}
              step={50}
              value={amountRange}
              onChange={(val) => setAmountRange(val as [number, number])}
              tooltip={{ formatter: (val) => `$${val} USDC` }}
              style={{ margin: '4px 0 8px 0' }}
            />
          </div>

          <Select
            value={durationFilter}
            onChange={setDurationFilter}
            style={{ width: 130 }}
            options={[
              { value: 'ALL', label: 'All Durations' },
              { value: 30, label: '<= 30 Days' },
              { value: 60, label: '<= 60 Days' },
              { value: 90, label: '<= 90 Days' },
            ]}
          />

          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 210 }}
            options={[
              { value: 'BEST_APR', label: '🔥 Best Rate (Lowest APR)' },
              { value: 'HIGHEST_APR', label: 'Highest APR' },
              { value: 'SHORTEST_DURATION', label: 'Shortest Duration' },
            ]}
          />
        </div>
      </div>

      {/* Main Content Area - Render Grouped by Amount Tier */}
      {activeTab === 'market' ? (
        groupedMarketTiers.length === 0 ? (
          <EmptyState
            title="No Open Marketplace Offers Found"
            description="There are currently no active offers matching your search criteria or amount range."
            action={
              <Button
                type="primary"
                icon={<PlusCircle size={16} />}
                onClick={() => setCreateDrawerOpen(true)}
                style={{ borderRadius: 10, fontWeight: 600, height: 42 }}
              >
                Create First Offer
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {groupedMarketTiers.map((group) => (
              <div key={`tier-${group.amount}-${group.asset}`}>
                {/* Amount Tier Group Section Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(248, 250, 252, 0.9)',
                    padding: '12px 20px',
                    borderRadius: '14px 14px 0 0',
                    border: '1px solid rgba(226, 232, 240, 0.9)',
                    borderBottom: 'none',
                  }}
                >
                  <Space size={12} align="center">
                    <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      <DollarSign size={16} />
                    </div>
                    <Text strong style={{ fontSize: 16, color: 'var(--text-main)', fontWeight: 800 }}>
                      {formatTokenAmount(group.amount, group.asset)} Tier Group
                    </Text>
                    <Tag color="blue" style={{ borderRadius: 12, fontWeight: 700, fontSize: 11 }}>
                      {group.offers.length} {group.offers.length === 1 ? 'Offer' : 'Offers'}
                    </Tag>
                  </Space>

                  <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
                      Best Tier Rate:
                    </Text>
                    <Tag color="green" style={{ borderRadius: 12, fontWeight: 800, fontSize: 12, padding: '2px 10px' }}>
                      🔥 {group.bestApr}% APR
                    </Tag>
                  </Space>
                </div>

                {/* Table for this specific Amount Tier */}
                <Card
                  className="card-premium"
                  styles={{ body: { padding: 0 } }}
                  style={{ borderRadius: '0 0 16px 16px', overflow: 'hidden', borderTop: 'none' }}
                >
                  <Table
                    columns={createTableColumns(group.bestApr, false)}
                    dataSource={group.offers}
                    rowKey="id"
                    pagination={false}
                  />
                </Card>
              </div>
            ))}
          </div>
        )
      ) : (
        groupedMyTiers.length === 0 ? (
          <EmptyState
            title="You Have No Active Listed Offers"
            description="Create a lending offer to list your USDC liquidity on the Nexus marketplace and earn fixed APR returns."
            action={
              <Button
                type="primary"
                icon={<PlusCircle size={16} />}
                onClick={() => setCreateDrawerOpen(true)}
                style={{ borderRadius: 10, fontWeight: 600, height: 42 }}
              >
                Create Offer Now
              </Button>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {groupedMyTiers.map((group) => (
              <div key={`my-tier-${group.amount}-${group.asset}`}>
                {/* My Offers Amount Tier Section Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(248, 250, 252, 0.9)',
                    padding: '12px 20px',
                    borderRadius: '14px 14px 0 0',
                    border: '1px solid rgba(226, 232, 240, 0.9)',
                    borderBottom: 'none',
                  }}
                >
                  <Space size={12} align="center">
                    <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                      <DollarSign size={16} />
                    </div>
                    <Text strong style={{ fontSize: 16, color: 'var(--text-main)', fontWeight: 800 }}>
                      {formatTokenAmount(group.amount, group.asset)} My Tier Group
                    </Text>
                    <Tag color="cyan" style={{ borderRadius: 12, fontWeight: 700, fontSize: 11 }}>
                      {group.offers.length} My Listed {group.offers.length === 1 ? 'Offer' : 'Offers'}
                    </Tag>
                  </Space>

                  <Tag color="purple" style={{ borderRadius: 12, fontWeight: 800, fontSize: 12, padding: '2px 10px' }}>
                    Lowest APR: {group.bestApr}%
                  </Tag>
                </div>

                <Card
                  className="card-premium"
                  styles={{ body: { padding: 0 } }}
                  style={{ borderRadius: '0 0 16px 16px', overflow: 'hidden', borderTop: 'none' }}
                >
                  <Table
                    columns={createTableColumns(group.bestApr, true)}
                    dataSource={group.offers}
                    rowKey="id"
                    pagination={false}
                  />
                </Card>
              </div>
            ))}
          </div>
        )
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
