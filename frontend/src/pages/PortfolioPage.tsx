import React, { useState } from 'react';
import { Typography, Button } from 'antd';
import { ArrowRightLeft } from 'lucide-react';
import { useAppContext } from '../app/AppContext';
import { useWallet } from '../hooks/useWallet';
import { isOpenLoanStatus } from '../utils/finance';
import { getConnectedWalletAddress, isSameWalletAddress } from '../utils/wallet';
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
  const { isConnected, publicKey } = useWallet();
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);

  if (!isConnected || !connectedWalletAddress) {
    return <EmptyPortfolio />;
  }

  if (errorState) {
    return <ErrorPortfolio onRetry={() => setErrorState(null)} rawError={errorState} />;
  }

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;
  const getAssetPrice = (asset: string) => {
    if (asset === 'XLM') return xlmPrice;
    if (asset === 'USDC') return usdcPrice;
    return 0;
  };
  const toUsd = (amount: number, asset: string) => amount * getAssetPrice(asset);

  const borrowedActive = loans.filter(
    (loan) => isSameWalletAddress(loan.borrower, connectedWalletAddress) && isOpenLoanStatus(loan.status)
  );
  const lentActive = loans.filter(
    (loan) => isSameWalletAddress(loan.lender, connectedWalletAddress) && isOpenLoanStatus(loan.status)
  );

  const totalBorrowedDebtUsd = borrowedActive.reduce((sum, loan) => sum + toUsd(loan.outstandingDebt, loan.asset), 0);
  const totalLentUsd = lentActive.reduce((sum, loan) => sum + toUsd(loan.amount, loan.asset), 0);
  const lockedCollateralUsd = borrowedActive.reduce(
    (sum, loan) => sum + toUsd(loan.collateralAmount, loan.collateralAsset),
    0
  );

  const xlmWalletBalance = wallet.balanceXLM || 0;
  const usdcWalletBalance = wallet.balanceUSDC || 0;
  const xlmUsd = xlmWalletBalance * xlmPrice;
  const usdcUsd = usdcWalletBalance * usdcPrice;
  const totalAvailableUsd = xlmUsd + usdcUsd;
  const netPositionUsd = totalAvailableUsd + totalLentUsd + lockedCollateralUsd - totalBorrowedDebtUsd;

  const walletBalancesByAsset: Record<string, number> = {
    USDC: usdcWalletBalance,
    XLM: xlmWalletBalance,
  };

  const assetSymbols = Array.from(new Set([
    'USDC',
    'XLM',
    ...borrowedActive.map((loan) => loan.asset),
    ...borrowedActive.map((loan) => loan.collateralAsset),
    ...lentActive.map((loan) => loan.asset),
  ]));

  const assetsData = assetSymbols
    .map((symbol) => {
      const walletBalance = walletBalancesByAsset[symbol] ?? 0;
      const locked = borrowedActive
        .filter((loan) => loan.collateralAsset === symbol)
        .reduce((sum, loan) => sum + loan.collateralAmount, 0);
      const lent = lentActive
        .filter((loan) => loan.asset === symbol)
        .reduce((sum, loan) => sum + loan.amount, 0);
      const borrowed = borrowedActive
        .filter((loan) => loan.asset === symbol)
        .reduce((sum, loan) => sum + loan.outstandingDebt, 0);
      const price = getAssetPrice(symbol);

      return {
        symbol,
        walletBalance,
        available: walletBalance,
        locked,
        lent,
        borrowed,
        usdValue: (walletBalance + locked + lent) * price,
        price,
      };
    })
    .filter((asset) => asset.walletBalance > 0 || asset.locked > 0 || asset.lent > 0 || asset.borrowed > 0);

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
        lockedAssetCount={assetsData.filter((asset) => asset.locked > 0).length}
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
