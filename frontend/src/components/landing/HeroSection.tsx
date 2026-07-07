import React from 'react';
import { Hero } from './Hero';

export const HeroSection: React.FC = () => {
  return (
    <section className="hero-container" style={{
      position: 'relative',
      padding: '60px 0 20px',
      background: 'radial-gradient(120% 120% at 50% -10%, #FFFFFF 40%, rgba(86, 204, 242, 0.04) 70%, rgba(47, 128, 237, 0.06) 100%)',
      overflow: 'hidden',
      borderBottom: '1px solid var(--border-color)',
    }}>
      {/* Connectors Keyframe Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes flow-right {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes flow-left {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 20; }
        }
        @media (max-width: 991px) {
          .hero-container {
            padding: 40px 0 10px !important;
          }
        }
      `}} />
      <Hero />
    </section>
  );
};
