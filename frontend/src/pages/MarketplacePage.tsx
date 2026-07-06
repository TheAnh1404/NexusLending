import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateRequiredCollateral, formatCurrency, formatAddress } from '../utils/finance';
import { RiskBadge } from '../components/common/RiskBadge';
import { OfferStatusBadge } from '../components/common/OfferStatusBadge';
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

export const MarketplacePage: React.FC = () => {
  const { loanOffers, oraclePrices } = useAppContext();
  const navigate = useNavigate();

  // State for Filters
  const [search, setSearch] = useState('');
  const [assetFilter, setAssetFilter] = useState('ALL');
  const [collateralFilter, setCollateralFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [aprSort, setAprSort] = useState<'ASC' | 'DESC'>('ASC');
  const [maxApr, setMaxApr] = useState<number>(15);
  const [maxDuration, setMaxDuration] = useState<number>(180);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // Filter loan offers dynamically
  const filteredOffers = loanOffers.filter((offer) => {
    const matchesSearch =
      offer.id.toLowerCase().includes(search.toLowerCase()) ||
      offer.lender.toLowerCase().includes(search.toLowerCase());
    const isListed = offer.status === 'Active';
    const matchesAsset = assetFilter === 'ALL' || offer.asset === assetFilter;
    const matchesCollateral = collateralFilter === 'ALL' || offer.collateralAsset === collateralFilter;
    const matchesApr = offer.apr <= maxApr;
    const matchesDuration = offer.duration <= maxDuration;

    return isListed && matchesSearch && matchesAsset && matchesCollateral && matchesApr && matchesDuration;
  }).sort((a, b) => (aprSort === 'ASC' ? a.apr - b.apr : b.apr - a.apr));

  const columns = [
    {
      title: 'Offer ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{text}</Text>,
    },
    {
      title: 'Principal',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => <Text strong>{formatCurrency(amount, record.asset)}</Text>,
    },
    {
      title: 'Fixed APR',
      dataIndex: 'apr',
      key: 'apr',
      render: (apr: number) => <Text style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{apr}%</Text>,
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (days: number) => <span>{days} Days</span>,
    },
    {
      title: 'Collateral Asset',
      dataIndex: 'collateralAsset',
      key: 'collateralAsset',
      render: (asset: string) => <Tag color="orange">{asset}</Tag>,
    },
    {
      title: 'Req. Collateral',
      key: 'reqCollateral',
      render: (_: any, record: any) => {
        const req = calculateRequiredCollateral(record.amount, 1.0, xlmPrice, record.maxLTV);
        return <span>{req.toLocaleString()} XLM</span>;
      },
    },
    {
      title: 'Max LTV',
      dataIndex: 'maxLTV',
      key: 'maxLTV',
      render: (ltv: number) => <span>{ltv}%</span>,
    },
    {
      title: 'Minimum HF',
      dataIndex: 'minHealthFactor',
      key: 'minHealthFactor',
      render: (hf: number) => <Text strong>{hf.toFixed(2)}</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => <OfferStatusBadge status={record.status} />,
    },
    {
      title: 'Risk Rating',
      key: 'riskRating',
      render: () => <RiskBadge zone="SAFE" />,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button size="small" onClick={() => navigate(`/app/loans/${record.id}`)}>
            View Details
          </Button>
          <Button size="small" type="primary" onClick={() => navigate(`/app/borrow/${record.id}`)}>
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
      <Card styles={{ body: { padding: '24px' } }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={6}>
            <Input
              prefix={<Search size={16} style={{ color: 'var(--text-muted)', marginRight: 6 }} />}
              placeholder="Search by Offer ID or Lender Address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              size="large"
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>LOAN ASSET</Text>
            <Select value={assetFilter} onChange={setAssetFilter} style={{ width: '100%' }} size="large">
              <Option value="ALL">All Assets</Option>
              <Option value="USDC">USDC</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>COLLATERAL ASSET</Text>
            <Select value={collateralFilter} onChange={setCollateralFilter} style={{ width: '100%' }} size="large">
              <Option value="ALL">All Collaterals</Option>
              <Option value="XLM">XLM</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>SORT APR</Text>
            <Select value={aprSort} onChange={setAprSort} style={{ width: '100%' }} size="large">
              <Option value="ASC">Lowest First</Option>
              <Option value="DESC">Highest First</Option>
            </Select>
          </Col>

          <Col xs={12} sm={6} md={6} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '6px', textAlign: 'right' }}>VIEW MODE</Text>
              <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="large">
                <Radio.Button value="GRID"><Grid size={16} style={{ marginTop: 4 }} /></Radio.Button>
                <Radio.Button value="TABLE"><ListIcon size={16} style={{ marginTop: 4 }} /></Radio.Button>
              </Radio.Group>
            </div>
          </Col>
        </Row>

        <Divider style={{ margin: '20px 0' }} />

        <Row gutter={[32, 24]}>
          <Col xs={24} sm={12}>
            <div style={{ paddingRight: '12px' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>MAX INTEREST RATE (APR)</span>
                <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{maxApr}%</span>
              </Text>
              <Slider min={4} max={18} step={0.5} value={maxApr} onChange={setMaxApr} tooltip={{ formatter: (val) => `${val}%` }} />
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div style={{ paddingLeft: '12px' }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>MAX LOAN DURATION</span>
                <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{maxDuration} Days</span>
              </Text>
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
        <Card styles={{ body: { padding: 0 } }}>
          <Table columns={columns} dataSource={filteredOffers.map((item) => ({ ...item, key: item.id }))} pagination={false} />
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          {filteredOffers.map((offer) => {
            const requiredCollateral = calculateRequiredCollateral(offer.amount, 1.0, xlmPrice, offer.maxLTV);
            return (
              <Col xs={24} sm={12} xl={8} key={offer.id}>
                <Card
                  className="card-premium"
                  styles={{ body: { padding: '24px' } }}
                  actions={[
                    <Button key="details" type="text" onClick={() => navigate(`/app/loans/${offer.id}`)}>
                      View Details
                    </Button>,
                    <Button key="borrow" type="primary" style={{ marginRight: 16 }} onClick={() => navigate(`/app/borrow/${offer.id}`)}>
                      Borrow Now <ArrowRight size={14} style={{ marginLeft: 4 }} />
                    </Button>,
                  ]}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {offer.id.toUpperCase()}
                      </span>
                      <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                        {formatCurrency(offer.amount, offer.asset)}
                      </Title>
                    </div>
                    <RiskBadge zone="SAFE" />
                  </div>

                  <div style={{
                    backgroundColor: 'var(--bg-color)',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary" style={{ fontSize: '13px' }}>Fixed Interest Rate:</Text>
                      <Text strong style={{ color: 'var(--primary-color)' }}>{offer.apr}% APR</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary" style={{ fontSize: '13px' }}>Duration:</Text>
                      <Text strong>{offer.duration} Days</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary" style={{ fontSize: '13px' }}>Required Collateral:</Text>
                      <Text strong style={{ color: '#E28743' }}>
                        {requiredCollateral.toLocaleString()} XLM
                      </Text>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Max LTV Allowed:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.maxLTV}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Minimum HF:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.minHealthFactor.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Liquidation Threshold:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{offer.liquidationThreshold}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Status:</span>
                      <OfferStatusBadge status={offer.status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Lender Address:</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatAddress(offer.lender)}
                      </span>
                    </div>
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

