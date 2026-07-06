export const formatDateTime = (value: string): string => new Date(value).toLocaleString();

export const formatDate = (value: string): string => new Date(value).toLocaleDateString();

export const formatPercent = (value: number, fractionDigits = 2): string =>
  `${value.toFixed(fractionDigits)}%`;

export const buildMockTxHash = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

