import React from 'react';
import { Row, Col, Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ShieldCheck,
  Heart,
  Fingerprint
} from 'lucide-react';
import { FeatureMiniCard } from './FeatureMiniCard';
import { HeroIllustration } from './HeroIllustration';
import { HeroStats } from './HeroStats';

const { Title, Paragraph } = Typography;

export const Hero: React.FC = () => {
  const navigate = useNavigate();

  const handleLaunch = () => {
    navigate('/connect');
  };

  const handleMarketplace = () => {
    navigate('/app/marketplace');
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Background Soft radial glows & particles */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '20%',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(47, 128, 237, 0.05) 0%, rgba(79, 70, 229, 0.02) 50%, rgba(255,255,255,0) 70%)',
        filter: 'blur(40px)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        top: '30%',
        right: '10%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(86, 204, 242, 0.06) 0%, rgba(255,255,255,0) 70%)',
        filter: 'blur(30px)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <Row gutter={[48, 48]} align="middle" style={{ minHeight: '680px', padding: '40px 20px 60px' }}>
          {/* Left Column (~45%) */}
          <Col xs={24} lg={11}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              {/* Badges */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{
                  background: 'rgba(47, 128, 237, 0.08)',
                  color: 'var(--primary-color)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  boxShadow: '0 2px 8px rgba(47, 128, 237, 0.04)',
                }}>
                  Stellar Soroban Protocol
                </span>
                <span style={{
                  background: 'rgba(39, 174, 96, 0.08)',
                  color: 'var(--success-color)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  Live Testnet MVP
                </span>
              </div>

              {/* Title */}
              <Title level={1} style={{
                fontSize: 'clamp(44px, 5.5vw, 68px)',
                lineHeight: 1.05,
                fontWeight: 900,
                fontFamily: 'var(--font-heading)',
                letterSpacing: '-0.03em',
                margin: 0,
                color: 'var(--text-main)',
              }}>
                Collateralized.<br />
                Secure.<br />
                Transparent.<br />
                <span style={{
                  background: 'linear-gradient(90deg, #2F80ED 0%, #4F46E5 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  Built on Stellar.
                </span>
              </Title>

              {/* Subheadline */}
              <Paragraph style={{
                fontSize: '16px',
                lineHeight: 1.6,
                color: 'var(--text-muted)',
                margin: '4px 0 12px 0',
                maxWidth: '480px',
              }}>
                Nexus Lending Protocol offers fixed-rate P2P lending. Secured by automated Smart Contract escrows, real-time oracle price feeds, and dynamic Health Factor liquidations.
              </Paragraph>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="primary"
                    size="large"
                    onClick={handleLaunch}
                    style={{
                      height: '50px',
                      padding: '0 28px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 8px 20px rgba(47, 128, 237, 0.15)',
                    }}
                  >
                    Launch App <ArrowRight size={16} />
                  </Button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="large"
                    onClick={handleMarketplace}
                    style={{
                      height: '50px',
                      padding: '0 24px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      borderColor: 'rgba(229, 231, 235, 0.8)',
                      background: 'rgba(255, 255, 255, 0.8)',
                      color: 'var(--text-main)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    View Marketplace
                  </Button>
                </motion.div>
              </div>

              {/* Feature Cards Grid */}
              <div style={{
                display: 'flex',
                gap: '14px',
                marginTop: '16px',
                flexWrap: 'wrap',
              }}>
                <FeatureMiniCard
                  icon={<ShieldCheck size={18} />}
                  title="Smart Escrow"
                  desc="Soroban contract custody"
                />
                <FeatureMiniCard
                  icon={<Heart size={18} />}
                  title="Health Factor"
                  desc="Dynamic ratio monitoring"
                />
                <FeatureMiniCard
                  icon={<Fingerprint size={18} />}
                  title="Verification"
                  desc="On-chain ledger records"
                />
              </div>
            </motion.div>
          </Col>

          {/* Right Column (~55%) */}
          <Col xs={24} lg={13} style={{ display: 'flex', justifyContent: 'center' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.0, ease: "easeOut", delay: 0.2 }}
              style={{ width: '100%' }}
            >
              <HeroIllustration />
            </motion.div>
          </Col>
        </Row>

        {/* Protocol Stats Card */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{ padding: '0 20px 40px' }}
        >
          <HeroStats />
        </motion.div>
      </div>
    </div>
  );
};
