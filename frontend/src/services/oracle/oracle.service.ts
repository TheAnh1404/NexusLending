import type { OraclePrice } from '../../types';

export const oracleService = {
  updateXlmPrice(prices: OraclePrice[], newPrice: number): OraclePrice[] {
    const current = prices.find((price) => price.asset === 'XLM')?.price ?? newPrice;
    const change24h = current > 0 ? Math.round(((newPrice - current) / current) * 10000) / 100 : 0;

    return prices.map((price) => {
      if (price.asset !== 'XLM') return price;
      return {
        ...price,
        price: newPrice,
        change24h,
        lastUpdated: new Date().toISOString(),
        source: 'Nexus Demo Oracle Admin',
      };
    });
  },
};

