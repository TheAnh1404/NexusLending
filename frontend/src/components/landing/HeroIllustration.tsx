import React from 'react';
import {
  Users,
  Coins,
  ShieldCheck,
  Heart,
  ArrowLeftRight
} from 'lucide-react';
import { SmartContractCube } from './SmartContractCube';
import { FloatingProtocolCard } from './FloatingProtocolCard';
import { AnimatedConnector } from './AnimatedConnector';

export const HeroIllustration: React.FC = () => {
  return (
    <div style={{
      width: '100%',
      maxWidth: '520px',
      height: '460px',
      position: 'relative',
      background: 'radial-gradient(50% 50% at 50% 50%, rgba(86, 204, 242, 0.12) 0%, rgba(255,255,255,0) 100%)',
      borderRadius: '24px',
      margin: '0 auto',
    }}>
      {/* SVG Connectors */}
      <AnimatedConnector d="M 95,85 C 95,170 170,230 260,230" color="#2F80ED" width={2.5} />
      <AnimatedConnector d="M 425,85 C 425,170 350,230 260,230" color="#F2994A" width={2.5} reverse />
      <AnimatedConnector d="M 260,230 L 260,370" color="#27AE60" width={2} />
      <AnimatedConnector d="M 445,260 C 370,260 320,230 260,230" color="#2F80ED" width={2} reverse />
      <AnimatedConnector d="M 75,260 C 150,260 200,230 260,230" color="#27AE60" width={2} />

      {/* Center 3D Glowing Smart Contract Cube */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
      }}>
        <SmartContractCube />
      </div>

      {/* Floating Card 1: Lender */}
      <FloatingProtocolCard
        icon={<Users size={16} />}
        title="Lender"
        desc="Funds Offer"
        value="10,000 USDC"
        valueColor="var(--primary-color)"
        style={{ top: '20px', left: '20px' }}
        delay={0.2}
        yOffset={8}
      />

      {/* Floating Card 2: Borrower */}
      <FloatingProtocolCard
        icon={<Coins size={16} />}
        title="Borrower"
        desc="Locks Collateral"
        value="+100,000 XLM"
        valueColor="#E28743"
        style={{ top: '20px', right: '20px' }}
        delay={0.8}
        yOffset={10}
      />

      {/* Floating Card 3: Escrow */}
      <FloatingProtocolCard
        icon={<ShieldCheck size={16} />}
        title="Escrow"
        desc="Locked Soroban"
        value="Secured"
        valueColor="var(--success-color)"
        badge="Active"
        badgeColor="var(--success-color)"
        style={{ bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}
        delay={1.4}
        yOffset={6}
      />

      {/* Floating Card 4: Health Factor */}
      <FloatingProtocolCard
        icon={<Heart size={16} style={{ color: 'var(--success-color)' }} />}
        title="Health Factor"
        desc="HF 1.52"
        value="SAFE"
        valueColor="var(--success-color)"
        badge="1.52"
        badgeColor="var(--success-color)"
        style={{ top: '210px', right: '10px' }}
        delay={0.5}
        yOffset={12}
      />

      {/* Floating Card 5: Repayment */}
      <FloatingProtocolCard
        icon={<ArrowLeftRight size={16} />}
        title="Repayment"
        desc="Returns Principal"
        value="10,800 USDC"
        valueColor="var(--success-color)"
        style={{ top: '210px', left: '10px' }}
        delay={1.1}
        yOffset={9}
      />
    </div>
  );
};
