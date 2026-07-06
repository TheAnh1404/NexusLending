import React from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { Rocket, Zap, Shield, Cpu, HelpCircle } from 'lucide-react';

const { Title, Paragraph } = Typography;

export const WhyStellarSection: React.FC = () => {
  const benefits = [
    {
      icon: <Rocket size={20} />,
      title: 'Fast Settlement',
      desc: 'Fast finality within a few seconds enables immediate liquidation executions and rapid collateral recovery.'
    },
    {
      icon: <Zap size={20} />,
      title: 'Fractional Fees',
      desc: 'Execute repayments, collateral additions, and liquidations for fractions of a cent, avoiding high gas fees.'
    },
    {
      icon: <Cpu size={20} />,
      title: 'Soroban Smart Contracts',
      desc: 'Safe, sandboxed WebAssembly execution environment built for predictability and efficiency.'
    },
    {
      icon: <Shield size={20} />,
      title: 'Financial Asset Support',
      desc: 'Native support for regulated assets, anchors, and fiat stablecoin issuers (USDC) out of the box.'
    },
    {
      icon: <HelpCircle size={20} />,
      title: 'Testnet Friendly',
      desc: 'Robust developer tools, sandboxes, and active testnets make MVP deployment and validation seamless.'
    }
  ];

  return (
    <section id="why-stellar" style={{
      padding: '90px 24px',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid var(--border-color)',
      position: 'relative'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .why-card {
          height: 100%;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          transition: all 0.3s ease;
          background: white;
        }
        .why-card:hover {
          transform: translateY(-2px);
          border-color: var(--primary-color);
          box-shadow: 0 8px 20px rgba(47, 128, 237, 0.04);
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
            Stellar Ecosystem
          </span>
          <Title level={2} style={{
            fontSize: 'clamp(28px, 3vw, 40px)',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            marginTop: '16px',
            marginBottom: '8px'
          }}>
            Why Stellar?
          </Title>
          <Paragraph style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto' }}>
            Stellar and Soroban provide the speed, security, and low-cost environment necessary for isolated lending markets.
          </Paragraph>
        </div>

        {/* Benefits Grid */}
        <Row gutter={[24, 24]} justify="center">
          {benefits.map((benefit, idx) => (
            <Col xs={24} sm={12} lg={benefit.title === 'Testnet Friendly' ? 12 : 6} key={idx}>
              <Card
                className="why-card"
                styles={{ body: { padding: '24px' } }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(47, 128, 237, 0.08)',
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  {benefit.icon}
                </div>
                
                <Title level={4} style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
                  {benefit.title}
                </Title>
                
                <Paragraph style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  {benefit.desc}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
};
