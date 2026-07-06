import React from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { ShieldAlert, TrendingDown, EyeOff } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const ProblemSection: React.FC = () => {
  const problems = [
    {
      title: 'Traditional P2P Lending',
      subtitle: 'Centralized & Friction-heavy',
      color: '#EB5757',
      bgLight: 'rgba(235, 87, 87, 0.04)',
      icon: <EyeOff size={24} />,
      points: [
        { title: 'Centralized Control', desc: 'Intermediaries dictate terms, approve users, and command hefty service fees.' },
        { title: 'Limited Transparency', desc: 'No verifiable on-chain record of loan status, repayments, or collateral health.' },
        { title: 'Manual Trust', desc: 'Relies on credit scores and manual verification instead of cryptographic guarantees.' },
        { title: 'Weak Collateral Protection', desc: 'Collateral is managed offline or via custodial systems prone to human error.' }
      ]
    },
    {
      title: 'Pool-based DeFi Lending',
      subtitle: 'Shared Risk & Floating Terms',
      color: '#F2994A',
      bgLight: 'rgba(242, 153, 74, 0.04)',
      icon: <TrendingDown size={24} />,
      points: [
        { title: 'No Direct Agreement', desc: 'Borrowers interact with a pool rather than agreeing on terms with a specific counterparty.' },
        { title: 'Floating Interest Rates', desc: 'APR fluctuates dynamically, leaving borrowers vulnerable to unexpected rate hikes.' },
        { title: 'No Individual Negotiation', desc: 'Terms are predetermined by governance parameters rather than market negotiation.' },
        { title: 'Pool-level Systemic Risk', desc: 'Bad debt from a few toxic borrow positions threatens the yield of all lenders.' }
      ]
    }
  ];

  return (
    <section id="problem" style={{
      padding: '90px 24px',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid var(--border-color)',
      position: 'relative'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .problem-card {
          transition: all 0.3s ease;
          border: 1px solid var(--border-color);
        }
        .problem-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }
        .point-item {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }
      `}} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{
            background: 'rgba(235, 87, 87, 0.08)',
            color: 'var(--danger-color)',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Lending Market Inefficiencies
          </span>
          <Title level={2} style={{
            fontSize: 'clamp(28px, 3vw, 40px)',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            marginTop: '16px',
            marginBottom: '8px'
          }}>
            The problem with current lending models
          </Title>
          <Paragraph style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto' }}>
            Traditional finance is slow and opaque, while modern DeFi pools introduce floating interest rates and shared protocol-wide insolvency risk.
          </Paragraph>
        </div>

        {/* Content columns */}
        <Row gutter={[32, 32]}>
          {problems.map((prob, i) => (
            <Col xs={24} md={12} key={i}>
              <Card
                className="problem-card"
                styles={{ body: { padding: '32px' } }}
                style={{
                  height: '100%',
                  borderRadius: '20px',
                  background: `linear-gradient(180deg, #FFFFFF 0%, ${prob.bgLight} 100%)`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: `rgba(${prob.color === '#EB5757' ? '235,87,87' : '242,153,74'}, 0.1)`,
                    color: prob.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {prob.icon}
                  </div>
                  <div>
                    <Title level={3} style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                      {prob.title}
                    </Title>
                    <Text type="secondary" style={{ fontSize: '13px', fontWeight: 500 }}>
                      {prob.subtitle}
                    </Text>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {prob.points.map((p, idx) => (
                    <div className="point-item" key={idx}>
                      <div style={{ marginTop: '2px', color: prob.color }}>
                        <ShieldAlert size={16} />
                      </div>
                      <div>
                        <Text strong style={{ fontSize: '14px', display: 'block', color: 'var(--text-main)' }}>
                          {p.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '13px', lineHeight: 1.5, display: 'block', marginTop: '2px' }}>
                          {p.desc}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </section>
  );
};
