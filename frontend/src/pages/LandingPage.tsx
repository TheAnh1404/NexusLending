import React from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { ProblemSection } from '../components/landing/ProblemSection';
import { SolutionSection } from '../components/landing/SolutionSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { HealthFactorSection } from '../components/landing/HealthFactorSection';
import { EscrowProtectionSection } from '../components/landing/EscrowProtectionSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { WhyStellarSection } from '../components/landing/WhyStellarSection';
import { LandingCTA } from '../components/landing/LandingCTA';

export const LandingPage: React.FC = () => {
  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', overflowX: 'hidden' }}>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <HealthFactorSection />
      <EscrowProtectionSection />
      <FeaturesSection />
      <WhyStellarSection />
      <LandingCTA />
    </div>
  );
};
