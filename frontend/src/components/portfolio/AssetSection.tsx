import React, { useState } from 'react';
import { Card, Typography, Input, Select, Button, Row, Col } from 'antd';
import { Search, Eye } from 'lucide-react';
import { AssetDrawer } from './AssetDrawer';

const { Title, Text } = Typography;

interface AssetData {
  symbol: string;
  walletBalance: number;
  available: number;
  locked: number;
  lent: number;
  borrowed: number;
  usdValue: number;
  price: number;
}

interface AssetSectionProps {
  assets: AssetData[];
}

export const AssetSection: React.FC<AssetSectionProps> = ({ assets }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'value_desc' | 'value_asc' | 'name'>('value_desc');
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredAssets = assets
    .filter((a) => a.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'value_desc') return b.usdValue - a.usdValue;
      if (sortBy === 'value_asc') return a.usdValue - b.usdValue;
      return a.symbol.localeCompare(b.symbol);
    });

  const handleViewAsset = (asset: AssetData) => {
    setSelectedAsset(asset);
    setDrawerOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header & Search/Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
            Assets
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Overview of individual token balances and allocated liquidity.
          </Text>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="Search asset..."
            prefix={<Search size={14} style={{ color: 'var(--text-muted)' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 180, borderRadius: 8 }}
            allowClear
          />

          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 150 }}
            options={[
              { value: 'value_desc', label: 'Highest Value' },
              { value: 'value_asc', label: 'Lowest Value' },
              { value: 'name', label: 'Asset Name' },
            ]}
          />
        </div>
      </div>

      {/* Asset Cards List View (NOT a Table!) */}
      {filteredAssets.length === 0 ? (
        <Card className="card-premium" styles={{ body: { padding: 32, textAlign: 'center' } }}>
          <Text type="secondary">No Assets Found</Text>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredAssets.map((asset) => (
            <Col xs={24} sm={12} key={asset.symbol}>
              <Card
                className="card-premium"
                styles={{ body: { padding: 20 } }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  {/* Top Symbol Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          backgroundColor: asset.symbol === 'USDC' ? '#2775ca' : '#14b8a6',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 16,
                        }}
                      >
                        {asset.symbol.slice(0, 1)}
                      </div>
                      <div>
                        <Text strong style={{ fontSize: 16 }}>{asset.symbol}</Text>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          ${asset.price.toFixed(4)} USD
                        </div>
                      </div>
                    </div>

                    <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                      ${asset.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Title>
                  </div>

                  {/* Asset Metrics */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8,
                      backgroundColor: 'var(--bg-subtle, #f8fafc)',
                      padding: 12,
                      borderRadius: 10,
                      marginBottom: 16,
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Wallet Balance</Text>
                      <div style={{ fontWeight: 700, marginTop: 2 }}>
                        {asset.walletBalance.toLocaleString()} {asset.symbol}
                      </div>
                    </div>

                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Available</Text>
                      <div style={{ fontWeight: 700, color: 'var(--success-color)', marginTop: 2 }}>
                        {asset.available.toLocaleString()} {asset.symbol}
                      </div>
                    </div>

                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Locked</Text>
                      <div style={{ fontWeight: 700, marginTop: 2 }}>
                        {asset.locked > 0 ? `${asset.locked.toLocaleString()} ${asset.symbol}` : '-'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* View Button */}
                <Button
                  type="default"
                  icon={<Eye size={14} />}
                  onClick={() => handleViewAsset(asset)}
                  block
                  style={{ borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  View Breakdown
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Asset Breakdown Drawer */}
      <AssetDrawer
        open={drawerOpen}
        asset={selectedAsset}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
};
