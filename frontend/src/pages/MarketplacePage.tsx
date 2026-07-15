import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { CHAIN_MODE } from '../services/api/client';
import { offersApi } from '../services/api/offers.api';
import { MAX_FIXED_APR_PERCENT, calculateRequiredCollateral, formatCurrency, formatAddress } from '../utils/finance';
import { EmptyState } from '../components/common/CommonStates';
import {
  Card,
  Input,
  Select,
  Button,
  Radio,
  Row,
  Col,
  Table,
  Space,
  Typography,
  Slider,
  Divider,
  Tag,
} from 'antd';
import {
  Search,
  Grid,
  List as ListIcon,
  PlusCircle,
  ArrowRight,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;
const MARKETPLACE_CHAIN_SYNC_INTERVAL_MS = 10_000;

export const MarketplacePage: React.FC = () => {
  const { loanOffers, oraclePrices, wallet, refreshData } = useAppContext();
  const navigate = useNavigate();

  // State for Filters
  const [search, setSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [collateralFilter, setCollateralFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [aprSort, setAprSort] = useState<'ASC' | 'DESC'>('ASC');
  const [maxApr, setMaxApr] = useState<number>(MAX_FIXED_APR_PERCENT);
  const [maxDuration, setMaxDuration] = useState<number>(180);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const activeChainOfferIds = React.useMemo(
    () => loanOffers
      .filter((offer) => offer.status === 'Active' && offer.contractOfferId !== undefined)
      .map((offer) => offer.id),
    [loanOffers]
  );
  const activeChainOfferIdsKey = activeChainOfferIds.join('|');

  React.useEffect(() => {
    if (CHAIN_MODE === 'mock' || !wallet.address || activeChainOfferIds.length === 0) return;

    let cancelled = false;
    const syncActiveOffers = async () => {
      const ids = activeChainOfferIdsKey.split('|').filter(Boolean);
      if (ids.length === 0) return;

      const results = await Promise.allSettled(
        ids.map((offerId) => offersApi.syncChain(offerId, wallet.address!))
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
  }, [activeChainOfferIds.length, activeChainOfferIdsKey, refreshData, wallet.address]);

  // Filter loan offers dynamically
  const filteredOffers = loanOffers.filter((offer) => {
    const matchesSearch =
      offer.id.toLowerCase().includes(search.toLowerCase()) ||
      offer.lender.toLowerCase().includes(search.toLowerCase());
    const isListed = offer.status === 'Active';
    const isAcceptableOnChain = CHAIN_MODE === 'mock' || offer.contractOfferId !== undefined;
    const matchesAsset = assetFilter === 'ALL' || offer.asset === assetFilter;
    const matchesCollateral = collateralFilter === 'ALL' || offer.collateralAsset === collateralFilter;
    const matchesApr = offer.apr <= maxApr;
    const matchesDuration = offer.duration <= maxDuration;

    return isListed && isAcceptableOnChain && matchesSearch && matchesAsset && matchesCollateral && matchesApr && matchesDuration;
  }).sort((a, b) => (aprSort === 'ASC' ? a.apr - b.apr : b.apr - a.apr));

  const columns = [
    {
      title: 'Offer Principal',
      key: 'principal',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <Text strong style={{ fontSize: '15px', color: 'var(--text-main)' }}>
            {formatCurrency(record.amount, record.asset)}
          </Text>
          <Text type="secondary" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
            ID: {record.id.slice(0, 8).toUpperCase()}...
          </Text>
        </div>
      ),
    },
    {
      title: 'Lending Terms',
      key: 'terms',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <Text strong style={{ color: 'var(--primary-color)', fontSize: '14px' }}>
            {record.apr}% APR
          </Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.duration} Days Term
          </Text>
        </div>
      ),
    },
    {
      title: 'Required Collateral',
      key: 'reqCollateral',
      render: (_: any, record: any) => {
        const req = calculateRequiredCollateral(record.amount, 1.0, xlmPrice, record.maxLTV);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Text strong style={{ color: '#E28743', fontSize: '14px' }}>
              {req.toLocaleString()} XLM
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Max LTV: {record.maxLTV}%
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Risk Profile & Safety',
      key: 'riskProfile',
      render: (_: any, record: any) => {
        const isHighRisk = record.maxLTV > 75 || record.liquidationThreshold > 85;
        const isModRisk = record.maxLTV > 60 || record.liquidationThreshold > 75;
        const riskLevel = isHighRisk 
          ? { label: 'High Risk', color: 'volcano' } 
          : isModRisk 
            ? { label: 'Moderate Risk', color: 'warning' } 
            : { label: 'Low Risk', color: 'success' };
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                Min HF: {record.minHealthFactor.toFixed(2)}
              </span>
              <Tag color={riskLevel.color} style={{ margin: 0, fontSize: '10px', border: 'none', lineHeight: '1.4', padding: '0 6px' }}>
                {riskLevel.label.toUpperCase()}
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Liq. Threshold: {record.liquidationThreshold}% LTV
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Lender Signature',
      dataIndex: 'lender',
      key: 'lender',
      render: (lender: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }} copyable={{ text: lender }}>
          {formatAddress(lender)}
        </Text>
      ),
    },
    {
      title: 'Security Escrow',
      key: 'escrowStatus',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div><Tag color="cyan" style={{ margin: 0, fontSize: '10px', border: 'none' }}>Escrow Funded</Tag></div>
          <div><Tag color="green" style={{ margin: 0, fontSize: '10px', border: 'none' }}>Active Listing</Tag></div>
        </div>
      ),
    },
    {
      title: 'Execution',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button size="middle" onClick={() => navigate(`/app/loans/${record.id}`)} style={{ borderRadius: '6px' }}>
            Specs
          </Button>
          <Button size="middle" type="primary" onClick={() => navigate(`/app/borrow/${record.id}`)} style={{ borderRadius: '6px', fontWeight: 600 }}>
            Borrow
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Lending Marketplace
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Select an isolated fixed-rate offer to borrow stablecoins, or create a custom contract.
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<PlusCircle size={16} />}
          onClick={() => navigate('/app/create-loan')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          Create Loan Offer
        </Button>
      </div>

      {/* Filter Card */}
      <Card styles={{ body: { padding: '24px' } }} style={{ border: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }}>
        <Row gutter={[20, 20]} align="middle">
          <Col xs={24} md={8}>
            <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>SEARCH CONTRACT</Text>
            <Input
              prefix={<Search size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />}
              placeholder="Search by Offer ID or Lender Address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              size="large"
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>LOAN ASSET</Text>
            <Select value={assetFilter} onChange={setAssetFilter} style={{ width: '100%' }} size="large">
              <Option value="ALL">All Assets</Option>
              <Option value="USDC">USDC</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>COLLATERAL</Text>
            <Select value={collateralFilter} onChange={setCollateralFilter} style={{ width: '100%' }} size="large">
              <Option value="ALL">All Collaterals</Option>
              <Option value="XLM">XLM</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>SORT BY APR</Text>
            <Select value={aprSort} onChange={setAprSort} style={{ width: '100%' }} size="large">
              <Option value="ASC">Lowest APR First</Option>
              <Option value="DESC">Highest APR First</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div>
              <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, display: 'block', marginBottom: '6px', textAlign: 'right', letterSpacing: '0.05em' }}>VIEW MODE</Text>
              <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="large">
                <Radio.Button value="GRID"><Grid size={14} style={{ marginTop: 5 }} /></Radio.Button>
                <Radio.Button value="TABLE"><ListIcon size={14} style={{ marginTop: 5 }} /></Radio.Button>
              </Radio.Group>
            </div>
          </Col>
        </Row>

        <Divider style={{ margin: '20px 0', borderColor: 'var(--border-light)' }} />

        <Row gutter={[32, 20]}>
          <Col xs={24} sm={12}>
            <div style={{ paddingRight: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MAX INTEREST RATE (APR)</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{maxApr}%</span>
              </div>
              <Slider min={4} max={MAX_FIXED_APR_PERCENT} step={0.5} value={maxApr} onChange={setMaxApr} tooltip={{ formatter: (val) => `${val}%` }} />
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div style={{ paddingLeft: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>MAX DURATION</span>
                <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{maxDuration} Days</span>
              </div>
              <Slider min={7} max={180} step={1} value={maxDuration} onChange={setMaxDuration} tooltip={{ formatter: (val) => `${val} Days` }} />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Grid or Table display */}
      {filteredOffers.length === 0 ? (
        <EmptyState
          title="No active loan offers yet."
          description="Try broadening your filters or create a custom loan offer to start lending."
          action={
            <Button type="primary" onClick={() => navigate('/app/create-loan')}>
              Create First Offer
            </Button>
          }
        />
      ) : viewMode === 'TABLE' ? (
        <Card styles={{ body: { padding: 0 } }} style={{ border: '1px solid var(--border-color)' }}>
          <Table columns={columns} dataSource={filteredOffers.map((item) => ({ ...item, key: item.id }))} pagination={false} />
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          {filteredOffers.map((offer) => {
            const requiredCollateral = calculateRequiredCollateral(offer.amount, 1.0, xlmPrice, offer.maxLTV);
            
            // Calculate estimated repayment
            const interest = offer.amount * (offer.apr / 100) * (offer.duration / 365);
            const estimatedRepayment = offer.amount + interest;

            return (
              <Col xs={24} sm={12} xl={8} key={offer.id}>
                <Card
                  className="card-premium"
                  styles={{ body: { padding: '24px' } }}
                  style={{ border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          ID: {offer.id.slice(0, 8).toUpperCase()}...
                        </span>
                        <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 800, fontFamily: 'var(--font-heading)', fontSize: '24px', letterSpacing: '-0.02em' }}>
                          {formatCurrency(offer.amount, offer.asset)}
                        </Title>
                      </div>
                      <Space size={4}>
                        <Tag color="cyan">Escrow Funded</Tag>
                        <Tag color="green">Active Offer</Tag>
                      </Space>
                    </div>

                    <div style={{
                      backgroundColor: 'var(--border-light)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '20px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Fixed Interest Rate:</Text>
                        <Text strong style={{ color: 'var(--primary-color)', fontSize: '13px' }}>{offer.apr}% APR</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Duration:</Text>
                        <Text strong style={{ fontSize: '13px' }}>{offer.duration} Days</Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Required Collateral:</Text>
                        <Text strong style={{ color: '#E28743', fontSize: '13px' }}>
                          {requiredCollateral.toLocaleString()} XLM
                        </Text>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '2px' }}>
                        <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>Est. Repayment:</Text>
                        <Text strong style={{ color: 'var(--success-color)', fontSize: '13px' }}>
                          {formatCurrency(estimatedRepayment, offer.asset)}
                        </Text>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Maximum LTV:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.maxLTV}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Minimum Health Factor:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.minHealthFactor.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Liquidation Threshold:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.liquidationThreshold}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Lender address:</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                          {formatAddress(offer.lender)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                    <Button style={{ flex: 1 }} onClick={() => navigate(`/app/loans/${offer.id}`)}>
                      Specs
                    </Button>
                    <Button type="primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }} onClick={() => navigate(`/app/borrow/${offer.id}`)}>
                      Borrow <ArrowRight size={14} />
                    </Button>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
};

