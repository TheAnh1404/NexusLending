export const normalizeWalletAddress = (address?: string | null): string =>
  address?.trim().toUpperCase() ?? '';

export const getConnectedWalletAddress = (
  publicKey?: string | null,
  fallbackAddress?: string | null,
): string => normalizeWalletAddress(publicKey ?? fallbackAddress);

export const isSameWalletAddress = (
  left?: string | null,
  right?: string | null,
): boolean => {
  const normalizedLeft = normalizeWalletAddress(left);
  return normalizedLeft !== '' && normalizedLeft === normalizeWalletAddress(right);
};
