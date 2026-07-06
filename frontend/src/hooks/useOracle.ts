import { useLending } from '../contexts/LendingContext';

export const useOracle = () => {
  const { oraclePrices, updateOraclePrice, recalculateAllHealthFactors } = useLending();

  return {
    oraclePrices,
    updateOraclePrice,
    recalculateAllHealthFactors,
    xlmPrice: oraclePrices.find((price) => price.asset === 'XLM')?.price ?? 0.125,
    usdcPrice: oraclePrices.find((price) => price.asset === 'USDC')?.price ?? 1,
  };
};

