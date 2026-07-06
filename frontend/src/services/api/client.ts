export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000').replace(/\/$/, '');
export const DATA_MODE = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'local';

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: {
    message?: string;
  };
}

export const apiClient = {
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const payload = await response.json().catch(() => ({})) as Partial<ApiEnvelope<T>> & ApiErrorEnvelope;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `API request failed: ${response.status}`);
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
