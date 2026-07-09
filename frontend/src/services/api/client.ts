export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000').replace(/\/$/, '');
export const DATA_MODE_STORAGE_KEY = 'nexus_data_mode';
export const MOCK_CONNECTED_STORAGE_KEY = 'nexus_mock_connected';
export const MOCK_ADDRESS_STORAGE_KEY = 'nexus_mock_address';
export const DEFAULT_MOCK_WALLET_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

const storedDataMode = typeof window !== 'undefined'
  ? window.localStorage.getItem(DATA_MODE_STORAGE_KEY)
  : null;
const envDataMode = import.meta.env.VITE_DATA_MODE;
const normalizedEnvMode = envDataMode === 'api' || envDataMode === 'mock'
  ? envDataMode
  : null;
const normalizedStoredMode = storedDataMode === 'api' || storedDataMode === 'mock'
  ? storedDataMode
  : null;
export const DATA_MODE = normalizedEnvMode || normalizedStoredMode || 'mock';

export const CHAIN_MODE = import.meta.env.VITE_CHAIN_MODE === 'mock' ? 'mock' : 'live';

export const apiUnavailableMessage = (): string =>
  `Cannot connect to backend API at ${API_URL}. Start the backend server on port 5000.`;

export const switchToMockMode = (
  redirectPath = '/app',
  walletAddress = DEFAULT_MOCK_WALLET_ADDRESS
): void => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(DATA_MODE_STORAGE_KEY, 'mock');
  window.localStorage.setItem(MOCK_CONNECTED_STORAGE_KEY, 'true');
  window.localStorage.setItem(MOCK_ADDRESS_STORAGE_KEY, walletAddress);
  window.location.assign(redirectPath);
};

export const switchToApiMode = (redirectPath = '/app'): void => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(DATA_MODE_STORAGE_KEY, 'api');
  window.localStorage.removeItem(MOCK_CONNECTED_STORAGE_KEY);
  window.localStorage.removeItem(MOCK_ADDRESS_STORAGE_KEY);
  window.location.assign(redirectPath);
};

export interface ConfirmedChainReceiptPayload {
  txHash: string;
  explorerUrl: string;
  ledger: number;
  txStatus: 'SUCCESS';
  contractId: string;
  blockTimestamp: string;
  contractReturnValue?: unknown;
}


interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: {
    message?: string;
    issues?: Array<{
      path?: Array<string | number>;
      message?: string;
    }>;
  };
}

export const apiClient = {
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } catch {
      throw new Error(apiUnavailableMessage());
    }

    const payload = await response.json().catch(() => ({})) as Partial<ApiEnvelope<T>> & ApiErrorEnvelope;

    if (!response.ok) {
      const issueDetails = payload.error?.issues
        ?.map((issue) => {
          const path = issue.path?.join('.');
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .filter(Boolean)
        .join('; ');
      const detail = [payload.error?.message, issueDetails].filter(Boolean).join(' - ');
      throw new Error(detail || `API request failed: ${response.status}`);
    }

    return payload.data as T;
  },

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    });
  },
};

export const toNumber = (value: string | number | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toBps = (percent: number): number => Math.round(percent * 100);

export const toHealthFactorBps = (healthFactor: number): number => Math.round(healthFactor * 10_000);
