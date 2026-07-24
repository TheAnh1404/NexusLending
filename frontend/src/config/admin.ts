import { normalizeWalletAddress } from '../utils/wallet';

export const DEFAULT_ADMIN_WALLET_ADDRESS = 'GDW5NJOOGRWNRJQ6XWWIN4X5OQGWIHUI2ZJEMQUTOEUCXMEHARXH2NXI';

export { normalizeWalletAddress };

export const ADMIN_WALLET_ADDRESS = normalizeWalletAddress(
  import.meta.env.VITE_ADMIN_WALLET_ADDRESS ?? DEFAULT_ADMIN_WALLET_ADDRESS
);

export const isAdminWallet = (address?: string | null): boolean =>
  normalizeWalletAddress(address) === ADMIN_WALLET_ADDRESS;
