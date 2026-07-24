import React, { useState } from 'react';
import { Typography, Button } from 'antd';
import { ArrowRightLeft } from 'lucide-react';
import { useAppContext } from '../app/AppContext';
import { isOpenLoanStatus } from '../utils/finance';
import { SwapModal } from '../components/common/SwapModal';
import { PortfolioSummary } from '../components/portfolio/PortfolioSummary';
import { PerformanceChart } from '../components/portfolio/PerformanceChart';
import { BreakdownChart } from '../components/portfolio/BreakdownChart';
import { AssetSection } from '../components/portfolio/AssetSection';
import { PositionSection } from '../components/portfolio/PositionSection';
import { EmptyPortfolio, ErrorPortfolio } from '../components/portfolio/PortfolioStates';

const { Title, Paragraph } = Typography;

export const PortfolioPage: React.FC = () => {
  const { wallet, loans, oraclePrices, refreshData } = useAppContext();
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  if (!wallet.connected) {
    return <EmptyPortfolio />;
  }

  if (errorState) {
    return <ErrorPortfolio onRetry={() => setErrorState(null)} rawError={errorState} />;
  }

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

  // Active positions calculation
  const borrowedActive = loans.filter((l) => l.borrower === wallet.address && isOpenLoanStatus(l.status));
  const lentActive = loans.filter((l) => l.lender === wallet.address && isOpenLoanStatus(l.status));

  const totalBorrowedDebtUsd = borrowedActive.reduce((sum, l) => sum + l.outstandingDebt, 0);
  const totalLentUsd = lentActive.reduce((sum, l) => sum + l.amount, 0);
  const totalLockedCollateralXlm = borrowedActive.reduce((sum, l) => sum + l.collateralAmount, 0);
  const lockedCollateralUsd = totalLockedCollateralXlm * xlmPrice;

  // Balances
  const xlmWalletBalance = wallet.balanceXLM || 0;
  const usdcWalletBalance = wallet.balanceUSDC || 0;

  const xlmUsd = xlmWalletBalance * xlmPrice;
  const usdcUsd = usdcWalletBalance * usdcPrice;

  const totalAvailableUsd = xlmUsd + usdcUsd;
  const netPositionUsd = totalAvailableUsd + totalLentUsd + lockedCollateralUsd - totalBorrowedDebtUsd;

  // Real Asset Data
  const assetsData = [
    {
      symbol: 'USDC',
      walletBalance: usdcWalletBalance,
      available: usdcWalletBalance,
      locked: 0,
      lent: totalLentUsd,
      borrowed: totalBorrowedDebtUsd,
      usdValue: usdcUsd,
      price: usdcPrice,
    },
    {
      symbol: 'XLM',
      walletBalance: xlmWalletBalance,
      available: Math.max(0, xlmWalletBalance - totalLockedCollateralXlm),
      locked: totalLockedCollateralXlm,
      lent: 0,
      borrowed: 0,
      usdValue: xlmUsd,
      price: xlmPrice,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800 }}>
            Portfolio
          </Title>
          <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 14 }}>
            Personal asset management dashboard for non-custodial lending & borrowing on Stellar.
          </Paragraph>
        </div>

        <Button
          type="primary"
          icon={<ArrowRightLeft size={16} />}
          onClick={() => setSwapModalOpen(true)}
          style={{ borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          Swap Assets
        </Button>
      </div>

      {/* SECTION 1: Portfolio Summary (4 Summary Cards) */}
      <PortfolioSummary
        netPositionUsd={netPositionUsd}
        totalLentUsd={totalLentUsd}
        activeLentCount={lentActive.length}
        totalBorrowedDebtUsd={totalBorrowedDebtUsd}
        activeBorrowedCount={borrowedActive.length}
        lockedCollateralUsd={lockedCollateralUsd}
        lockedAssetCount={totalLockedCollateralXlm > 0 ? 1 : 0}
      />

      {/* SECTION 2: Performance */}
      <PerformanceChart />

      {/* SECTION 3: Portfolio Breakdown */}
      <BreakdownChart
        availableUsd={totalAvailableUsd}
        lentUsd={totalLentUsd}
        borrowedUsd={totalBorrowedDebtUsd}
        lockedCollateralUsd={lockedCollateralUsd}
        xlmUsd={xlmUsd}
        usdcUsd={usdcUsd}
        xlmBalance={xlmWalletBalance}
        usdcBalance={usdcWalletBalance}
      />

      {/* SECTION 4: Assets (Card List View) */}
      <AssetSection assets={assetsData} />

      {/* SECTION 5: Positions (Borrowing & Lending Tabs) */}
      <PositionSection
        borrowedLoans={borrowedActive}
        lentLoans={lentActive}
        onRefresh={() => refreshData()}
      />

      {/* Quick Swap Modal */}
      <SwapModal open={swapModalOpen} onCancel={() => setSwapModalOpen(false)} />
    </div>
  );
};
