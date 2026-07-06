import React from 'react';
import { Col, Row, Typography, Tag } from 'antd';
import { ShieldCheck, Eye, Coins, Lock } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const EscrowProtectionSection: React.FC = () => {
  return (
    <section id="escrow-protection" style={{
      padding: '90px 24px',
      backgroundColor: '#FFFFFF',
      borderBottom: '1px solid var(--border-color)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .feature-box {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 24px;
          background: #F8FAFC;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          height: 100%;
          transition: all 0.2s ease;
        }
        .feature-box:hover {
          border-color: var(--primary-color);
          background: rgba(47, 128, 237, 0.01);
        }
      `}} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Row gutter={[48, 48]} align="middle">
          {/* Left Side: Detail list */}
          <Col xs={24} lg={12}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span style={{
                background: 'rgba(86, 204, 242, 0.1)',
                color: 'var(--primary-color)',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                alignSelf: 'flex-start'
              }}>
                On-Chain Asset Security
              </span>
              <Title level={2} style={{
                fontSize: 'clamp(28px, 3vw, 40px)',
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                marginTop: '8px',
                marginBottom: '8px'
              }}>
                Funded offers. <br />No fake liquidity.
              </Title>
              <Paragraph style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                On Nexus, we eliminate ghost offers and advertising spam. Every loan offer in our marketplace represents real, verified funds already locked in smart contract escrows.
              </Paragraph>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <div className="feature-box">
                    <div style={{ color: 'var(--primary-color)' }}>
                      <Lock size={20} />
                    </div>
                    <div>
                      <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                        Locked First
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                        Lenders must fund offers immediately. Funds are held securely in Soroban escrow.
                      </Text>
                    </div>
                  </div>
                </Col>

                <Col xs={24} sm={12}>
                  <div className="feature-box">
                    <div style={{ color: 'var(--success-color)' }}>
                      <Eye size={20} />
                    </div>
                    <div>
                      <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                        100% Verified
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                        Borrowers only browse offers backed by actual on-chain deposits. No ads.
                      </Text>
                    </div>
                  </div>
                </Col>

                <Col xs={24} sm={12}>
                  <div className="feature-box">
                    <div style={{ color: 'var(--warning-color)' }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                        Double Protection
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                        Escrow contract holds both lender stablecoins and borrower collateral.
                      </Text>
                    </div>
                  </div>
                </Col>

                <Col xs={24} sm={12}>
                  <div className="feature-box">
                    <div style={{ color: 'var(--primary-color)' }}>
                      <Coins size={20} />
                    </div>
                    <div>
                      <Text strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                        No Pool Vulnerability
                      </Text>
                      <Text type="secondary" style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                        Funds are never mixed. Yield and risk are isolated to individual contracts.
                      </Text>
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </Col>

          {/* Right Side: Graphic Visual of Vault Security */}
          <Col xs={24} lg={12} style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: '100%',
              maxWidth: '440px',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
              padding: '40px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)',
              position: 'relative'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(47, 128, 237, 0.08)',
                color: 'var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <Lock size={32} />
              </div>

              <Title level={4} style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0' }}>
                Nexus Segregated Vault
              </Title>
              <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '24px' }}>
                Soroban Smart Escrow State
              </Text>

              <div style={{
                background: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12.5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                  <Text type="secondary">Contract Status:</Text>
                  <Tag color="success" style={{ margin: 0, fontWeight: 600 }}>ACTIVE ESCROW</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                  <Text type="secondary">Escrowed USDC Balance:</Text>
                  <Text strong>10,000.00 USDC</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                  <Text type="secondary">Escrowed XLM Collateral:</Text>
                  <Text strong>80,000.00 XLM</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary">Audit Verification Hash:</Text>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    CC7A...9F21
                  </span>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </section>
  );
};
