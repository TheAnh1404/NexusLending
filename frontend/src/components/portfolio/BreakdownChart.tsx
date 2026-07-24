import React, { useState } from 'react';
import { Card, Typography, Segmented, Row, Col } from 'antd';

const { Title, Text } = Typography;

interface BreakdownChartProps {
  availableUsd: number;
  lentUsd: number;
  borrowedUsd: number;
  lockedCollateralUsd: number;
  xlmUsd: number;
  usdcUsd: number;
  xlmBalance: number;
  usdcBalance: number;
}

export const BreakdownChart: React.FC<BreakdownChartProps> = ({
  availableUsd,
  lentUsd,
  borrowedUsd,
  lockedCollateralUsd,
  xlmUsd,
  usdcUsd,
  xlmBalance,
  usdcBalance,
}) => {
  const [tab, setTab] = useState<'position' | 'asset'>('position');

  const totalPositionValue = availableUsd + lentUsd + lockedCollateralUsd;

  // Tab 1: By Position data
  const positionItems: Array<{ label: string; subtext?: string; value: number; color: string; pct: number }> = [
    { label: 'Available Balance', value: availableUsd, color: '#4f46e5', pct: totalPositionValue > 0 ? (availableUsd / totalPositionValue) * 100 : 0 },
    { label: 'Lending', value: lentUsd, color: '#10b981', pct: totalPositionValue > 0 ? (lentUsd / totalPositionValue) * 100 : 0 },
    { label: 'Locked Collateral', value: lockedCollateralUsd, color: '#f59e0b', pct: totalPositionValue > 0 ? (lockedCollateralUsd / totalPositionValue) * 100 : 0 },
    { label: 'Borrowing Debt', value: borrowedUsd, color: '#ef4444', pct: totalPositionValue > 0 ? (borrowedUsd / totalPositionValue) * 100 : 0 },
  ];

  // Tab 2: By Asset data (Real assets only)
  const totalAssetUsd = xlmUsd + usdcUsd;
  const assetItems = [
    { label: 'USDC', subtext: `${usdcBalance.toLocaleString()} USDC`, value: usdcUsd, color: '#2775ca', pct: totalAssetUsd > 0 ? (usdcUsd / totalAssetUsd) * 100 : 0 },
    { label: 'XLM', subtext: `${xlmBalance.toLocaleString()} XLM`, value: xlmUsd, color: '#14b8a6', pct: totalAssetUsd > 0 ? (xlmUsd / totalAssetUsd) * 100 : 0 },
  ];

  const currentItems = tab === 'position' ? positionItems : assetItems;

  return (
    <Card className="card-premium" styles={{ body: { padding: 24 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
            Portfolio Breakdown
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Distribution of capital across active positions and assets.
          </Text>
        </div>

        <Segmented
          value={tab}
          onChange={(val) => setTab(val as 'position' | 'asset')}
          options={[
            { label: 'By Position', value: 'position' },
            { label: 'By Asset', value: 'asset' },
          ]}
        />
      </div>

      <Row align="middle" gutter={[32, 24]}>
        {/* Visual Bar Distribution Chart */}
        <Col xs={24} md={10}>
          <div style={{ padding: '16px 0' }}>
            <div
              style={{
                height: 24,
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                backgroundColor: '#e2e8f0',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)',
                marginBottom: 16,
              }}
            >
              {currentItems.map((item, idx) =>
                item.pct > 0 ? (
                  <div
                    key={idx}
                    style={{
                      width: `${item.pct}%`,
                      backgroundColor: item.color,
                      height: '100%',
                      transition: 'width 0.3s ease',
                    }}
                    title={`${item.label}: ${item.pct.toFixed(1)}%`}
                  />
                ) : null
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Total Breakdown Pool</Text>
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                ${(tab === 'position' ? totalPositionValue : totalAssetUsd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Title>
            </div>
          </div>
        </Col>

        {/* Legend on the right */}
        <Col xs={24} md={14}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {currentItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  borderRadius: 10,
                  border: '1px solid var(--border-light, #f1f5f9)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: item.color }} />
                  <div>
                    <Text strong style={{ fontSize: 14 }}>{item.label}</Text>
                    {item.subtext && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.subtext}</div>}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: 14 }}>
                    ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {item.pct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Col>
      </Row>
    </Card>
  );
};
