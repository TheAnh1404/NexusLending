import React, { useState } from 'react';
import { Card, Typography, Segmented } from 'antd';
import { BarChart2 } from 'lucide-react';

const { Title, Text, Paragraph } = Typography;

export const PerformanceChart: React.FC = () => {
  const [metric, setMetric] = useState<'value' | 'interest'>('value');
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '90D' | 'All'>('30D');

  // No fake historical backend chart data available
  const hasHistoricalData = false;

  return (
    <Card className="card-premium" styles={{ body: { padding: 24 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
            Performance
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Historical portfolio tracking and yield performance over time.
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Metric Selector */}
          <Segmented
            value={metric}
            onChange={(val) => setMetric(val as 'value' | 'interest')}
            options={[
              { label: 'Portfolio Value', value: 'value' },
              { label: 'Interest Earned', value: 'interest' },
            ]}
          />

          {/* Timeframe Selector */}
          <Segmented
            value={timeframe}
            onChange={(val) => setTimeframe(val as '7D' | '30D' | '90D' | 'All')}
            options={['7D', '30D', '90D', 'All']}
          />
        </div>
      </div>

      {/* Empty State when no historical backend points exist */}
      {!hasHistoricalData && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 16px',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            borderRadius: 12,
            border: '1px dashed var(--border-color, #e2e8f0)',
          }}
        >
          <BarChart2 size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <Title level={5} style={{ margin: '0 0 6px 0', fontWeight: 700 }}>
            No Performance History Yet
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 13, margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Historical snapshot tracking will populate automatically as your positions mature on the Soroban network.
          </Paragraph>
        </div>
      )}
    </Card>
  );
};
