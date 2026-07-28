import { apiClient } from './client';

export type UserRole = 'LENDER' | 'BORROWER' | 'LIQUIDATOR';

export interface BackendUser {
  id: string;
  wallet: string;
  role?: UserRole | null;
  displayName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  ensureExists(wallet: string): Promise<BackendUser> {
    return apiClient.post<BackendUser>('/api/users/connect', { wallet });
  },
};
