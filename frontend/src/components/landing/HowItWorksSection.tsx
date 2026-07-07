import React, { useState } from 'react';
import { Card, Col, Row, Typography, Steps } from 'antd';
import { Shield, Sparkles, User, Database, Percent, Coins, RotateCw } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const HowItWorksSection: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const stepsDetails = [
    {
      title: 'Lender Creates & Funds',
      desc: 'Lender publishes an offer with their custom terms (amount, APR, duration, LTV, liquidation threshold) and deposits the principal USDC.',
      icon: <Percent size={20} />,
      badge: 'LENDER ACTION'
    },
    {
      title: 'Escrow Locks Assets',
      desc: 'The Soroban contract vault locks the USDC. No fake orders are allowed on the ledger; liquidity is fully validated first.',
      icon: <Shield size={20} />,
      badge: 'SMART CONTRACT'
    },
    {
      title: 'Borrower Selects Offer',
      desc: 'Borrowers search the public ledger for terms that suit their cash flow and match their collateral requirements.',
      icon: <User size={20} />,
      badge: 'BORROWER ACTION'
    },
    {
      title: 'Borrower Locks Collateral',
      desc: 'Borrower locks the required XLM collateral into the contract. Collateral stays segregated to back this individual loan agreement.',
      icon: <Coins size={20} />,
      badge: 'ESCROW DEPOSIT'
    },
    {
      title: 'Oracle Risk Evaluation',
      desc: 'The on-chain Oracle calculates the exact market value of the collateral to establish the starting Health Factor.',
      icon: <Database size={20} />,
      badge: 'ORACLE FEED'
    },
    {
      title: 'Loan Activates (HF >= 1.4)',
      desc: 'If the starting Health Factor is safe (>= 1.4), the contract releases the USDC to the borrower and begins the duration timer.',
      icon: <Sparkles size={20} />,
      badge: 'SAFETY TRIGGER'
    },
    {
      title: 'Repay, Rescue or Liquidate',
      desc: 'Borrower repays principal + interest to reclaim collateral. If HF falls below 1.2, liquidators can trigger partial liquidations to protect lenders.',
      icon: <RotateCw size={20} />,
      badge: 'LOAN MATURITY'
    }
  ];

  return (
    <section id="how-it-works" style={{
      padding: '90px 24px',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid var(--border-color)',
      position: 'relative'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .how-card {
          border: 1px solid var(--border-color);
          transition: all 0.3s ease;
          border-radius: 16px;
        }
        .how-card-active {
          border-color: var(--primary-color) !important;
          box-shadow: var(--shadow-lg);
          background: rgba(47, 128, 237, 0.01);
        }
        .how-step-badge {
          background: rgba(47, 128, 237, 0.08);
          color: var(--primary-color);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          display: inline-block;
          margin-bottom: 12px;
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
            Protocol Workflow
          </span>
          <Title level={2} style={{
            fontSize: 'clamp(28px, 3vw, 40px)',
            fontWeight: 800,
            fontFamily: 'var(--font-heading)',
            marginTop: '16px',
            marginBottom: '8px'
          }}>
            How It Works
          </Title>
          <Paragraph style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto' }}>
            Follow the transparent lifecycle of a Nexus loan, from creation to settlement. Click each step to see details.
          </Paragraph>
        </div>

        <Row gutter={[40, 40]} align="middle">
          {/* Left Side: Interactive Steps Selector */}
          <Col xs={24} md={10}>
            <Steps
              orientation="vertical"
              current={currentStep}
              onChange={setCurrentStep}
              items={stepsDetails.map((s, idx) => ({
                title: <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.title}</span>,
                content: <span style={{ display: 'none' }}>{s.desc}</span>, // hide content in steps list
                icon: (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: currentStep === idx ? 'var(--primary-color)' : 'var(--border-color)',
                    color: currentStep === idx ? 'white' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    {idx + 1}
                  </div>
                )
              }))}
            />
          </Col>

          {/* Right Side: Active Step Detail Card */}
          <Col xs={24} md={14}>
            <Card
              className="how-card how-card-active"
              styles={{ body: { padding: '40px' } }}
            >
              <div className="how-step-badge">
                {stepsDetails[currentStep].badge}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(47, 128, 237, 0.08)',
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {stepsDetails[currentStep].icon}
                </div>
                <Title level={3} style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
                  {stepsDetails[currentStep].title}
                </Title>
              </div>

              <Paragraph style={{
                fontSize: '15px',
                lineHeight: 1.7,
                color: 'var(--text-main)',
                margin: 0
              }}>
                {stepsDetails[currentStep].desc}
              </Paragraph>

              <div style={{
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Step {currentStep + 1} of {stepsDetails.length}
                </Text>
                <Text
                  style={{
                    color: 'var(--primary-color)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onClick={() => setCurrentStep((prev) => (prev + 1) % stepsDetails.length)}
                >
                  Next Step &rarr;
                </Text>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </section>
  );
};
