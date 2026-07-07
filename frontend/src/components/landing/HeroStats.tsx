import React from 'react';
import { Row, Col } from 'antd';
import { ProtocolMetric } from './ProtocolMetric';
import { useAppContext } from '../../app/AppContext';

export const HeroStats: React.FC = () => {
  const { loanOffers, loans, oraclePrices } = useAppContext();
  
  // Calculate active offers (status === 'Active')
  const activeOffersCount = loanOffers.filter(o => o.status === 'Active').length;
  
  // Calculate active loans (status === 'Active' || status === 'Warning')
  const activeLoansCount = loans.filter(l => l.status === 'Active' || l.status === 'Warning').length;

  // Calculate XLM price & Oracle Age
  const xlmPriceData = oraclePrices.find(p => p.asset === 'XLM');
  const xlmPrice = xlmPriceData?.price ?? 0.125;
  
  // Calculate total locked collateral value (in USDC equivalent)
  const totalCollateralAmount = loans
    .filter(l => ['Active', 'Warning', 'PendingCollateral'].includes(l.status))
    .reduce((sum, l) => sum + l.collateralAmount, 0);
  const collateralValueUSD = totalCollateralAmount * xlmPrice;

  // Oracle age calculation
  const getOracleAgeText = () => {
    if (!xlmPriceData?.lastUpdated) return 'Unknown';
    const secondsAgo = Math.max(0, Math.floor((new Date().getTime() - new Date(xlmPriceData.lastUpdated).getTime()) / 1000));
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo}m ago`;
  };

  return (
    <div style={{
      padding: '24px',
      background: 'rgba(255, 255, 255, 0.45)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(229, 231, 235, 0.6)',
      borderRadius: '24px',
      boxShadow: '0 15px 35px rgba(0, 0, 0, 0.03)',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-color)', marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Live Protocol Telemetry
      </div>
      <Row gutter={[16, 16]} justify="space-between">
        <Col xs={24} sm={12} md={6}>
          <ProtocolMetric title="Active Offers" targetValue={activeOffersCount} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProtocolMetric title="Active Loans" targetValue={activeLoansCount} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProtocolMetric title="Collateral Locked" targetValue={collateralValueUSD} prefix="$" decimals={2} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProtocolMetric title={`XLM Oracle (${getOracleAgeText()})`} targetValue={xlmPrice} prefix="$" decimals={4} />
        </Col>
      </Row>
    </div>
  );
};
