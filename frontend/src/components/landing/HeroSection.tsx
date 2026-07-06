import React from 'react';
import { Button, Row, Col, Typography, Card } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Coins, Users } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();

  const handleLaunch = () => {
    navigate('/connect');
  };

  const handleMarketplace = () => {
    navigate('/app/marketplace');
  };

  const handleScrollToHow = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById('how-it-works');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-container" style={{
      position: 'relative',
      padding: '120px 24px 80px',
      background: 'radial-gradient(120% 120% at 50% -10%, #FFFFFF 40%, rgba(86, 204, 242, 0.08) 70%, rgba(47, 128, 237, 0.12) 100%)',
      overflow: 'hidden',
      borderBottom: '1px solid var(--border-color)',
    }}>
      {/* Inline styles for custom animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(12px) rotate(-1deg); }
        }
        @keyframes flow-right {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes flow-left {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 24; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(47, 128, 237, 0.15); }
          50% { box-shadow: 0 4px 35px rgba(47, 128, 237, 0.35); }
        }
        .animate-float-1 { animation: float-slow 7s infinite ease-in-out; }
        .animate-float-2 { animation: float-reverse 8s infinite ease-in-out; }
        .animate-float-3 { animation: float-slow 6s infinite ease-in-out 1s; }
        .glow-active { animation: glow-pulse 4s infinite ease-in-out; }
        .flow-line {
          stroke-dasharray: 8, 4;
          animation: flow-right 1.5s infinite linear;
        }
        .flow-line-reverse {
          stroke-dasharray: 8, 4;
          animation: flow-left 1.5s infinite linear;
        }
        .hero-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(47, 128, 237, 0.3) !important;
        }
        .hero-btn-secondary:hover {
          background: rgba(47, 128, 237, 0.05) !important;
          border-color: var(--primary-color) !important;
          color: var(--primary-color) !important;
        }
      `}} />

      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <Row gutter={[48, 48]} align="middle">
          {/* Text Content */}
          <Col xs={24} lg={12}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: 'rgba(47, 128, 237, 0.08)',
                  color: 'var(--primary-color)',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.03em'
                }}>
                  Stellar Soroban Protocol
                </span>
                <span style={{
                  background: 'rgba(39, 174, 96, 0.08)',
                  color: 'var(--success-color)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  Live Testnet MVP
                </span>
              </div>

              <Title level={1} style={{
                fontSize: 'clamp(38px, 4.5vw, 60px)',
                lineHeight: 1.1,
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--text-main)'
              }}>
                Nexus Lending <br />
                <span style={{
                  background: 'linear-gradient(90deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>Protocol</span>
              </Title>

              <Title level={3} style={{
                fontSize: '20px',
                fontWeight: 600,
                lineHeight: 1.4,
                margin: '8px 0 0 0',
                color: '#334155',
                fontFamily: 'var(--font-body)'
              }}>
                Fixed-rate P2P lending secured by collateral and Health Factor risk management.
              </Title>

              <Paragraph style={{
                fontSize: '15px',
                lineHeight: 1.6,
                color: 'var(--text-muted)',
                margin: '8px 0 24px 0',
                maxWidth: 540
              }}>
                A decentralized marketplace where lenders fund individual loan offers, borrowers choose the best terms, and every loan is protected by escrow, oracle pricing, and liquidation rules.
              </Paragraph>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <Button
                  type="primary"
                  size="large"
                  onClick={handleLaunch}
                  className="hero-btn-primary"
                  style={{
                    height: '52px',
                    padding: '0 28px',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Launch App <ArrowRight size={18} />
                </Button>
                
                <Button
                  size="large"
                  onClick={handleMarketplace}
                  className="hero-btn-secondary"
                  style={{
                    height: '52px',
                    padding: '0 24px',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 600,
                    borderColor: 'var(--border-color)',
                    background: 'white',
                    color: 'var(--text-main)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  View Marketplace
                </Button>
                
                <Button
                  type="link"
                  size="large"
                  onClick={handleScrollToHow}
                  style={{
                    fontSize: '15px',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0,
                    height: '52px'
                  }}
                >
                  Learn How It Works
                </Button>
              </div>
            </div>
          </Col>

          {/* Interactive Visual Diagram */}
          <Col xs={24} lg={12} style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
            <div style={{
              width: '100%',
              maxWidth: '520px',
              height: '420px',
              position: 'relative',
              background: 'radial-gradient(50% 50% at 50% 50%, rgba(86, 204, 242, 0.15) 0%, rgba(255,255,255,0) 100%)',
              borderRadius: '24px',
              padding: '20px'
            }}>
              
              {/* SVG connection lines with animated dashes */}
              <svg style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1
              }}>
                {/* Lender to Escrow (USDC flow) */}
                <path d="M 110,130 C 180,130 180,210 260,210" fill="none" stroke="#2F80ED" strokeWidth="2.5" className="flow-line" />
                {/* Borrower to Escrow (XLM flow) */}
                <path d="M 410,130 C 340,130 340,210 260,210" fill="none" stroke="#F2994A" strokeWidth="2.5" className="flow-line-reverse" />
                {/* Escrow to Borrower (USDC release) */}
                <path d="M 260,210 C 260,280 340,300 410,300" fill="none" stroke="#27AE60" strokeWidth="2.0" className="flow-line" />
              </svg>

              {/* Node 1: Lender */}
              <div className="animate-float-1" style={{
                position: 'absolute',
                left: '20px',
                top: '70px',
                zIndex: 2,
                width: '140px'
              }}>
                <Card style={{
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-md)',
                  textAlign: 'center',
                  padding: '12px'
                }} styles={{ body: { padding: 0 } }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(47, 128, 237, 0.1)',
                    color: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    <Users size={18} />
                  </div>
                  <Text strong style={{ fontSize: '13px', display: 'block' }}>Lender</Text>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>Funds Offer</Text>
                  <div style={{
                    marginTop: '8px',
                    background: 'rgba(47, 128, 237, 0.08)',
                    borderRadius: '8px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    color: 'var(--primary-color)',
                    fontWeight: 600,
                    display: 'inline-block'
                  }}>
                    10,000 USDC
                  </div>
                </Card>
              </div>

              {/* Node 2: Borrower */}
              <div className="animate-float-2" style={{
                position: 'absolute',
                right: '20px',
                top: '70px',
                zIndex: 2,
                width: '140px'
              }}>
                <Card style={{
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-md)',
                  textAlign: 'center',
                  padding: '12px'
                }} styles={{ body: { padding: 0 } }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(242, 153, 74, 0.1)',
                    color: 'var(--warning-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    <Users size={18} />
                  </div>
                  <Text strong style={{ fontSize: '13px', display: 'block' }}>Borrower</Text>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>Locks Collateral</Text>
                  <div style={{
                    marginTop: '8px',
                    background: 'rgba(242, 153, 74, 0.08)',
                    borderRadius: '8px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    color: 'var(--warning-color)',
                    fontWeight: 600,
                    display: 'inline-block'
                  }}>
                    100,000 XLM
                  </div>
                </Card>
              </div>

              {/* Node 3: Escrow (Center) */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                width: '150px'
              }}>
                <Card className="glow-active" style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '20px',
                  border: '2px solid var(--primary-color)',
                  textAlign: 'center',
                  padding: '14px'
                }} styles={{ body: { padding: 0 } }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(47, 128, 237, 0.1)',
                    color: 'var(--primary-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    <ShieldCheck size={22} />
                  </div>
                  <Text strong style={{ fontSize: '14px', display: 'block', color: 'var(--primary-color)' }}>Smart Escrow</Text>
                  <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginTop: '2px' }}>Locked Soroban Contract</Text>
                  
                  <div style={{
                    marginTop: '10px',
                    background: '#27AE60',
                    borderRadius: '20px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: 'white',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    HF: 1.52 (SAFE)
                  </div>
                </Card>
              </div>

              {/* Node 4: Liquidator / Repayment Outcome */}
              <div className="animate-float-3" style={{
                position: 'absolute',
                right: '20px',
                bottom: '40px',
                zIndex: 2,
                width: '140px'
              }}>
                <Card style={{
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-md)',
                  textAlign: 'center',
                  padding: '12px'
                }} styles={{ body: { padding: 0 } }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'rgba(39, 174, 96, 0.1)',
                    color: 'var(--success-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px'
                  }}>
                    <Coins size={18} />
                  </div>
                  <Text strong style={{ fontSize: '13px', display: 'block' }}>Borrower Out</Text>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '2px' }}>USDC Released</Text>
                  <div style={{
                    marginTop: '8px',
                    background: 'rgba(39, 174, 96, 0.08)',
                    borderRadius: '8px',
                    padding: '2px 6px',
                    fontSize: '11px',
                    color: 'var(--success-color)',
                    fontWeight: 600,
                    display: 'inline-block'
                  }}>
                    +10,000 USDC
                  </div>
                </Card>
              </div>

            </div>
          </Col>
        </Row>
      </div>

      {/* Subtle background nodes */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '5%',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        backgroundColor: 'rgba(86, 204, 242, 0.25)',
        filter: 'blur(1px)'
      }} className="animate-float-1"></div>
      <div style={{
        position: 'absolute',
        bottom: '20%',
        left: '40%',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: 'rgba(47, 128, 237, 0.15)',
        filter: 'blur(2px)'
      }} className="animate-float-2"></div>
    </section>
  );
};
