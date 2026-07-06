import React from 'react';
import { Card, Col, Row, Typography } from 'antd';
import {
  Percent,
  Layers,
  ShieldCheck,
  Activity,
  HeartHandshake,
  DollarSign,
  Flame,
  LineChart
} from 'lucide-react';

const { Title, Paragraph } = Typography;

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: <Percent size={22} />,
      title: 'Fixed-Rate Loan Offers',
      desc: 'Lock in predictable interest rates. Borrowers and lenders agree on fixed terms for the entire duration.'
    },
    {
      icon: <Layers size={22} />,
      title: 'Active Funded Marketplace',
      desc: 'Browse and select only real, funded credit positions. No empty listings or ghost liquidity.'
    },
    {
      icon: <ShieldCheck size={22} />,
      title: 'Escrow Asset Protection',
      desc: 'Both collateral and borrowing principal are stored in isolated smart contract escrows on the Stellar ledger.'
    },
    {
      icon: <Activity size={22} />,
      title: 'Health Factor Monitoring',
      desc: 'Keep track of risk with precision. Real-time updates show if a loan is Safe, Warning, or near liquidation.'
    },
    {
      icon: <HeartHandshake size={22} />,
      title: 'Add Collateral Rescue',
      desc: 'Borrowers can inject additional XLM collateral at any time to boost their Health Factor and avoid liquidations.'
    },
    {
      icon: <DollarSign size={22} />,
      title: 'Partial Repayment',
      desc: 'Repay debt in installments to reduce outstanding principal and organically improve the Health Factor.'
    },
    {
      icon: <Flame size={22} />,
      title: 'Open Liquidation',
      desc: 'A permissionless system. Any user can act as a liquidator to resolve distressed loans and earn a bonus.'
    },
    {
      icon: <LineChart size={22} />,
      title: 'Oracle-Based Pricing',
      desc: 'Oracle feeds report real-time XLM/USDC market prices to drive transparent liquidation triggers.'
    }
  ];

  return (
    <section id="features" style={{
      padding: '90px 24px',
      background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
      borderBottom: '1px solid var(--border-color)',
      position: 'relative'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .feature-card {
          height: 100%;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          transition: all 0.3s ease;
          background: white;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: rgba(47, 128, 237, 0.25);
        }
      `}} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{
            background: 'rgba(86, 204, 242, 0.1)',
            color: 'var(--primary-color)',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Advanced Features
          </span>
          <Title level={2} style={{
            fontSize: 'clamp(28px, 3vw, 40px)',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            marginTop: '16px',
            marginBottom: '8px'
          }}>
            Engineered for collateral safety
          </Title>
          <Paragraph style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto' }}>
            Explore the core protocols backing every direct P2P agreement on our Web3 platform.
          </Paragraph>
        </div>

        {/* Features Grid */}
        <Row gutter={[24, 24]}>
          {features.map((feat, idx) => (
            <Col xs={24} sm={12} lg={6} key={idx}>
              <Card
                className="feature-card"
                styles={{ body: { padding: '24px' } }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(47, 128, 237, 0.06)',
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  {feat.icon}
                </div>
                
                <Title level={4} style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                  {feat.title}
                </Title>
                
                <Paragraph style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  {feat.desc}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
};
