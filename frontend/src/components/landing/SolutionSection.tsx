import React from 'react';
import { Card, Col, Row, Typography } from 'antd';
import { CheckCircle2, ShieldCheck, DollarSign, Award, ArrowRight } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const SolutionSection: React.FC = () => {
  const steps = [
    {
      icon: <DollarSign size={20} />,
      title: 'Lender Creates & Funds',
      desc: 'Lender defines fixed APR, duration, LTV parameters, and funds the offer in USDC.'
    },
    {
      icon: <ShieldCheck size={20} />,
      title: 'Locked in Escrow',
      desc: 'Offer becomes visible and Active in the marketplace only after funds are locked in the contract escrow.'
    },
    {
      icon: <ArrowRight size={20} />,
      title: 'Borrower Selects Term',
      desc: 'Borrowers browse the marketplace and choose the exact contract matching their preferences.'
    },
    {
      icon: <Award size={20} />,
      title: 'Safe Activation',
      desc: 'Borrower deposits XLM collateral. The loan activates only if the initial Health Factor is safe (HF >= 1.4).'
    }
  ];

  return (
    <section id="solution" style={{
      padding: '90px 24px',
      background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)',
      borderBottom: '1px solid var(--border-color)',
      position: 'relative'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .solution-step-card {
          border: 1px solid var(--border-color);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 16px;
          height: 100%;
          background: white;
        }
        .solution-step-card:hover {
          transform: translateY(-2px);
          border-color: var(--primary-color);
          box-shadow: 0 10px 25px -5px rgba(47, 128, 237, 0.08);
        }
        .step-number {
          font-size: 36px;
          font-weight: 800;
          color: rgba(47, 128, 237, 0.1);
          line-height: 1;
        }
      `}} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <span style={{
            background: 'rgba(47, 128, 237, 0.08)',
            color: 'var(--primary-color)',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            The Nexus Solution
          </span>
          <Title level={2} style={{
            fontSize: 'clamp(28px, 3vw, 40px)',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            marginTop: '16px',
            marginBottom: '8px'
          }}>
            A true P2P lending marketplace
          </Title>
          <Paragraph style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto' }}>
            Nexus matches lenders and borrowers directly in isolated, fixed-term, escrow-backed contracts. No shared pools, no variable rate surprises.
          </Paragraph>
        </div>

        {/* Steps Grid */}
        <Row gutter={[24, 24]}>
          {steps.map((step, idx) => (
            <Col xs={24} sm={12} lg={6} key={idx}>
              <Card
                className="solution-step-card"
                styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' } }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(47, 128, 237, 0.08)',
                      color: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {step.icon}
                    </div>
                    <span className="step-number">0{idx + 1}</span>
                  </div>

                  <Title level={4} style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 10px 0' }}>
                    {step.title}
                  </Title>
                  
                  <Paragraph style={{ fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                    {step.desc}
                  </Paragraph>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-color)', fontSize: '12px', fontWeight: 600, marginTop: '20px' }}>
                  <CheckCircle2 size={14} /> Trustless Protocol
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Business Rule Callout */}
        <div style={{
          marginTop: '48px',
          background: 'rgba(47, 128, 237, 0.03)',
          border: '1px dashed rgba(47, 128, 237, 0.25)',
          borderRadius: '16px',
          padding: '24px 32px',
          textAlign: 'center'
        }}>
          <Text strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
            💡 Core Rule: Lenders MUST fund their offer up-front. Borrowers only interact with real, funded liquidity. Every transaction is isolated to protect both parties.
          </Text>
        </div>
      </div>
    </section>
  );
};
