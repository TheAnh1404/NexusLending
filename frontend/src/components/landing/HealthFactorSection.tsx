import React, { useState } from 'react';
import { Card, Col, Row, Typography, Slider } from 'antd';
import { ShieldCheck, AlertTriangle, Flame, Info } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const HealthFactorSection: React.FC = () => {
  const [demoHF, setDemoHF] = useState<number>(1.5);

  const getZoneDetails = (hf: number) => {
    if (hf >= 1.4) {
      return {
        label: 'SAFE ZONE',
        color: 'var(--success-color)',
        bgColor: 'rgba(39, 174, 96, 0.08)',
        icon: <ShieldCheck size={20} style={{ color: 'var(--success-color)' }} />,
        desc: 'Loan is secure. Collateral value is well above the debt limit. No action is required.',
        tagColor: 'success'
      };
    } else if (hf >= 1.2) {
      return {
        label: 'WARNING ZONE',
        color: 'var(--warning-color)',
        bgColor: 'rgba(242, 153, 74, 0.08)',
        icon: <AlertTriangle size={20} style={{ color: 'var(--warning-color)' }} />,
        desc: 'Risk is elevated. Collateral value is dropping. Borrower is advised to add XLM collateral or repay debt to rescue the position.',
        tagColor: 'warning'
      };
    } else {
      return {
        label: 'LIQUIDATION PLANNING',
        color: 'var(--danger-color)',
        bgColor: 'rgba(235, 87, 87, 0.08)',
        icon: <Flame size={20} style={{ color: 'var(--danger-color)' }} />,
        desc: 'Position is unhealthy. The loan is eligible for partial liquidation. Third-party liquidators can repay up to 50% of the debt to claim discounted collateral.',
        tagColor: 'error'
      };
    }
  };

  const activeZone = getZoneDetails(demoHF);

  // Calculate pointer position in percentage (from 0.8 HF to 2.0 HF)
  const getPointerPosition = (hf: number) => {
    const min = 0.8;
    const max = 2.0;
    const percentage = ((hf - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  return (
    <section id="health-factor" style={{
      padding: '90px 24px',
      background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
      borderBottom: '1px solid var(--border-color)',
      position: 'relative'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .risk-bar {
          height: 16px;
          border-radius: 8px;
          background: linear-gradient(90deg, var(--danger-color) 0%, var(--warning-color) 40%, var(--success-color) 80%);
          position: relative;
          margin: 32px 0 16px;
        }
        .risk-pointer {
          position: absolute;
          top: -8px;
          width: 32px;
          height: 32px;
          background: white;
          border: 3px solid var(--primary-color);
          border-radius: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justifyContent: center;
          font-weight: 800;
          font-size: 11px;
          box-shadow: var(--shadow-md);
          transition: left 0.1s ease, border-color 0.2s ease;
          cursor: grab;
        }
        .risk-zone-card {
          border: 1px solid var(--border-color);
          border-radius: 16px;
          background: white;
          transition: all 0.3s ease;
        }
      `}} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{
            background: 'rgba(39, 174, 96, 0.08)',
            color: 'var(--success-color)',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Risk Management Engine
          </span>
          <Title level={2} style={{
            fontSize: 'clamp(28px, 3vw, 40px)',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            marginTop: '16px',
            marginBottom: '8px'
          }}>
            Health Factor Risk Zones
          </Title>
          <Paragraph style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto' }}>
            Nexus protects assets dynamically. Health Factor tracks collateral health in real-time. Use the simulator below to see how safety zones change.
          </Paragraph>
        </div>

        <Row gutter={[48, 48]} align="middle">
          {/* Left Side: Interactive Slider & Meter */}
          <Col xs={24} lg={12}>
            <Card styles={{ body: { padding: '32px' } }} style={{ borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: '15px' }}>Simulate Health Factor</Text>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: activeZone.color,
                  fontFamily: 'var(--font-mono)'
                }}>
                  {demoHF.toFixed(2)}
                </div>
              </div>

              {/* Custom Meter */}
              <div className="risk-bar">
                <div
                  className="risk-pointer"
                  style={{
                    left: `${getPointerPosition(demoHF)}%`,
                    borderColor: activeZone.color
                  }}
                >
                  HF
                </div>
              </div>

              {/* Labels below meter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                <span>0.8 (Critical)</span>
                <span style={{ color: 'var(--danger-color)' }}>Liquidation Line (1.2)</span>
                <span style={{ color: 'var(--success-color)' }}>Safe Line (1.4)</span>
                <span>2.0 (High Safe)</span>
              </div>

              <div style={{ marginTop: '40px' }}>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                  DRAG SLIDER TO ADJUST HEALTH FACTOR:
                </Text>
                <Slider
                  min={0.8}
                  max={2.0}
                  step={0.05}
                  value={demoHF}
                  onChange={setDemoHF}
                  tooltip={{ formatter: (val) => `HF: ${val?.toFixed(2)}` }}
                />
              </div>
            </Card>
          </Col>

          {/* Right Side: Zone Details Display */}
          <Col xs={24} lg={12}>
            <Card
              className="risk-zone-card"
              styles={{ body: { padding: '40px', background: activeZone.bgColor, display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {activeZone.icon}
                <span style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  color: activeZone.color,
                  letterSpacing: '0.03em'
                }}>
                  {activeZone.label}
                </span>
              </div>

              <Paragraph style={{
                fontSize: '15px',
                lineHeight: 1.6,
                color: 'var(--text-main)',
                margin: 0
              }}>
                {activeZone.desc}
              </Paragraph>

              <div style={{
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <Info size={16} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                <Text type="secondary" style={{ fontSize: '12.5px', lineHeight: 1.5 }}>
                  The Health Factor formula: <br />
                  <code style={{ background: 'rgba(0,0,0,0.04)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    HF = (Collateral Value * Liquidation Threshold) / Borrowed Value
                  </code>
                </Text>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </section>
  );
};
