import React from 'react';
import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Wallet } from 'lucide-react';

const { Title, Paragraph } = Typography;

export const LandingCTA: React.FC = () => {
  const navigate = useNavigate();

  const handleLaunch = () => {
    navigate('/connect');
  };

  return (
    <section style={{
      padding: '100px 24px',
      background: 'radial-gradient(100% 100% at 50% 100%, rgba(86, 204, 242, 0.06) 0%, #FFFFFF 100%)',
      textAlign: 'center',
      position: 'relative'
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .cta-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(47, 128, 237, 0.3) !important;
        }
        .cta-btn-secondary:hover {
          background: rgba(47, 128, 237, 0.05) !important;
          border-color: var(--primary-color) !important;
          color: var(--primary-color) !important;
        }
      `}} />

      <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
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
          Get Started Today
        </span>
        
        <Title level={2} style={{
          fontSize: 'clamp(28px, 4vw, 42px)',
          fontWeight: 850,
          fontFamily: 'var(--font-heading)',
          lineHeight: 1.2,
          margin: 0,
          color: 'var(--text-main)'
        }}>
          Build trustless lending <br />
          <span style={{
            background: 'linear-gradient(90deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>without liquidity pools.</span>
        </Title>
        
        <Paragraph style={{
          fontSize: '15px',
          color: 'var(--text-muted)',
          lineHeight: 1.65,
          maxWidth: '560px',
          margin: '0 0 16px 0'
        }}>
          Deploy isolated credit agreements, verify real funded orders, monitor active risk levels, and borrow against assets with minimal overhead.
        </Paragraph>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            type="primary"
            size="large"
            onClick={handleLaunch}
            className="cta-btn-primary"
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
            onClick={handleLaunch}
            className="cta-btn-secondary"
            style={{
              height: '52px',
              padding: '0 24px',
              borderRadius: '10px',
              fontSize: '15px',
              fontWeight: 600,
              borderColor: 'var(--border-color)',
              background: 'white',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.3s ease'
            }}
          >
            <Wallet size={16} /> Connect Wallet
          </Button>
        </div>
      </div>
    </section>
  );
};
