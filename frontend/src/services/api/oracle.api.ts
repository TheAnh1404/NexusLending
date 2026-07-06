import type { OraclePrice } from '../../types';
import { apiClient, toNumber } from './client';

interface BackendOraclePrice {
  id: string;
  assetPair: string;
  baseAsset?: string | null;
  quoteAsset?: string | null;
  price: string;
  decimals: number;
  source: string;
  updatedAt: string;
}

interface RecalculateResponse {
  updatedCount: number;
  loans: unknown[];
}

const mapBackendPrice = (price: BackendOraclePrice): OraclePrice => ({
  asset: price.baseAsset ?? price.assetPair.split('/')[0] ?? price.assetPair,
  price: toNumber(price.price),
  lastUpdated: price.updatedAt,
  change24h: 0,
  source: price.source,
});

const withStablecoinFallback = (prices: OraclePrice[]): OraclePrice[] => {
  const hasUsdc = prices.some((price) => price.asset === 'USDC');
  if (hasUsdc) return prices;
  return [
    ...prices,
    {
      asset: 'USDC',
      price: 1,
      lastUpdated: new Date().toISOString(),
      change24h: 0,
      source: 'Stablecoin peg',
    },
  ];
};

export const oracleApi = {
  async list(): Promise<OraclePrice[]> {
    const prices = await apiClient.get<BackendOraclePrice[]>('/api/oracle/prices');
    return withStablecoinFallback(prices.map(mapBackendPrice));
  },

  async updateXlmPrice(newPrice: number, wallet?: string | null): Promise<{
    prices: OraclePrice[];
    recalculation: RecalculateResponse;
  }> {
    await apiClient.post<BackendOraclePrice>('/api/oracle/prices', {
      assetPair: 'XLM/USDC',
      baseAsset: 'XLM',
      quoteAsset: 'USDC',
      price: String(newPrice),
      decimals: 7,
      source: 'Nexus Frontend Oracle Simulator',
      updatedAt: new Date().toISOString(),
      wallet: wallet ?? 'ORACLE_ADMIN',
    });
    const recalculation = await apiClient.post<RecalculateResponse>('/api/oracle/recalculate-health');
    const prices = await this.list();
    return { prices, recalculation };
  },

  async recalculateHealth(): Promise<RecalculateResponse> {
    return apiClient.post<RecalculateResponse>('/api/oracle/recalculate-health');
  },
};
