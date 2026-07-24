import React, { useState } from 'react';
import { Typography, Button, Tag, Row, Col } from 'antd';
import { Sparkles, ShieldCheck, TrendingUp, Zap, PlusCircle, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../app/AppContext';
import { EscrowLogicModal } from './EscrowLogicModal';

const { Title, Paragraph, Text } = Typography;

interface MarketplaceBannerProps {
  onCreateOffer: () => void;
}

export const MarketplaceBanner: React.FC<MarketplaceBannerProps> = ({ onCreateOffer }) => {
  const { loanOffers, oraclePrices } = useAppContext();
  const [escrowModalOpen, setEscrowModalOpen] = useState(false);

  const activeOffers = loanOffers.filter((o) => o.status === 'Active');
  const maxApr = activeOffers.length > 0 ? Math.max(...activeOffers.map((o) => o.apr)) : 12;
  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  return (
    <>
      <div
        className="marketplace-hero-banner"
        style={{
          position: 'relative',
          borderRadius: '20px',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 80%, #1e1548 100%)',
          padding: '36px 32px',
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.5), 0 0 30px rgba(79, 70, 229, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          marginBottom: '28px',
        }}
      >
        {/* Animated Glowing Ambient Orbs */}
        <div
          className="ambient-orb-1"
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-40px',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(99, 102, 241, 0) 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="ambient-orb-2"
          style={{
            position: 'absolute',
            bottom: '-60px',
            left: '30%',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, rgba(6, 182, 212, 0) 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />

        <Row align="middle" gutter={[32, 24]}>
          {/* Left Column: Headline & Action Buttons */}
          <Col xs={24} lg={15}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, zIndex: 2, position: 'relative' }}>
              {/* Live Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    color: '#34d399',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      boxShadow: '0 0 10px #10b981',
                      animation: 'pulse 2s infinite',
                    }}
                  />
                  STELLAR SOROBAN ESCROW • LIVE PROTOCOL
                </div>

                <Tag
                  icon={<Sparkles size={12} style={{ color: '#f59e0b' }} />}
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: '#fbbf24',
                    fontWeight: 600,
                    borderRadius: 20,
                    padding: '2px 10px',
                  }}
                >
                  Up to {maxApr}% Fixed APR
                </Tag>
              </div>

              {/* Title */}
              <Title
                level={1}
                style={{
                  color: '#ffffff',
                  margin: 0,
                  fontWeight: 900,
                  fontSize: '32px',
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                }}
              >
                Peer-to-Peer Fixed Yield Lending{' '}
                <span
                  style={{
                    background: 'linear-gradient(90deg, #818cf8 0%, #38bdf8 50%, #34d399 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Powered by Soroban Smart Escrow
                </span>
              </Title>

              {/* Paragraph */}
              <Paragraph
                style={{
                  color: 'rgba(226, 232, 240, 0.85)',
                  margin: 0,
                  fontSize: '15px',
                  lineHeight: 1.6,
                  maxWidth: '620px',
                }}
              >
                Borrow USDC against XLM collateral with guaranteed fixed rates or create a custom lending offer to earn high-yield returns with automated smart contract liquidation protection.
              </Paragraph>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 8, flexWrap: 'wrap' }}>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusCircle size={18} />}
                  onClick={onCreateOffer}
                  style={{
                    height: '48px',
                    padding: '0 28px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                    border: 'none',
                    boxShadow: '0 8px 20px -4px rgba(79, 70, 229, 0.5)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                  }}
                >
                  Create Offer Now
                </Button>

                <Button
                  type="default"
                  size="large"
                  onClick={() => setEscrowModalOpen(true)}
                  style={{
                    height: '48px',
                    padding: '0 22px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <span>Learn Escrow Logic</span>
                  <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          </Col>

          {/* Right Column: Floating Stat Cards with Glassmorphism */}
          <Col xs={24} lg={9}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, zIndex: 2, position: 'relative' }}>
              <div
                className="banner-stat-card"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <Text strong style={{ color: '#ffffff', fontSize: '14px', display: 'block' }}>
                    100% Non-Custodial
                  </Text>
                  <Text style={{ color: 'rgba(203, 213, 225, 0.8)', fontSize: '12px' }}>
                    Direct Soroban smart contract custody
                  </Text>
                </div>
              </div>

              <div
                className="banner-stat-card"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#34d399',
                  }}
                >
                  <TrendingUp size={20} />
                </div>
                <div>
                  <Text strong style={{ color: '#ffffff', fontSize: '14px', display: 'block' }}>
                    Oracle Reference Feed
                  </Text>
                  <Text style={{ color: 'rgba(203, 213, 225, 0.8)', fontSize: '12px' }}>
                    XLM Price: ${xlmPrice.toFixed(4)} USD
                  </Text>
                </div>
              </div>

              <div
                className="banner-stat-card"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: 'rgba(6, 182, 212, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                  }}
                >
                  <Zap size={20} />
                </div>
                <div>
                  <Text strong style={{ color: '#ffffff', fontSize: '14px', display: 'block' }}>
                    ~3s Settlement Speed
                  </Text>
                  <Text style={{ color: 'rgba(203, 213, 225, 0.8)', fontSize: '12px' }}>
                    Instant execution on Stellar network
                  </Text>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Interactive Soroban Escrow Logic Modal */}
      <EscrowLogicModal
        open={escrowModalOpen}
        onClose={() => setEscrowModalOpen(false)}
      />
    </>
  );
};
