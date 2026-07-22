import {
  getAddress as freighterGetAddress,
  getNetworkDetails,
  isConnected as freighterIsConnected,
  requestAccess,
  signTransaction as freighterSignTransaction,
  WatchWalletChanges,
} from '@stellar/freighter-api';
import { NETWORK_DISPLAY_NAME, NETWORK_PASSPHRASE } from '../soroban/config';

const TESTNET_NETWORK = 'TESTNET';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const CONNECTED_STORAGE_KEY = 'nexus_freighter_connected';

type FreighterApiError = {
  code?: number;
  message?: string;
};

type FreighterResponse<T> = T & {
  error?: FreighterApiError;
};

export interface FreighterNetwork {
  network: string;
  networkUrl: string;
  networkPassphrase: string;
  sorobanRpcUrl?: string;
}

export interface FreighterConnection {
  publicKey: string;
  network: FreighterNetwork;
  isTestnet: boolean;
  isExpectedNetwork: boolean;
}

export interface SignedTransaction {
  signedTxXdr: string;
  signerAddress: string;
}

const normalizeError = (error: unknown, fallback: string): Error => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (/declin|reject|denied/i.test(message)) {
      return new Error('Connection request was rejected in Freighter.');
    }
    if (message) return new Error(message);
  }

  if (error instanceof Error) {
    if (/declin|reject|denied/i.test(error.message)) {
      return new Error('Connection request was rejected in Freighter.');
    }
    return error;
  }

  return new Error(fallback);
};

const assertNoFreighterError = <T>(response: FreighterResponse<T>, fallback: string): T => {
  if (response.error) {
    throw normalizeError(response.error, fallback);
  }
  return response;
};

const toFreighterNetwork = (response: Awaited<ReturnType<typeof getNetworkDetails>>): FreighterNetwork => ({
  network: response.network,
  networkUrl: response.networkUrl,
  networkPassphrase: response.networkPassphrase,
  sorobanRpcUrl: response.sorobanRpcUrl,
});

export const isNetworkTestnet = (network: Pick<FreighterNetwork, 'network' | 'networkPassphrase'>): boolean =>
  network.network === TESTNET_NETWORK || network.networkPassphrase === TESTNET_PASSPHRASE;

export const isNetworkExpected = (network: Pick<FreighterNetwork, 'networkPassphrase'>): boolean =>
  network.networkPassphrase === NETWORK_PASSPHRASE;

export const expectedNetworkLabel = NETWORK_DISPLAY_NAME;

export const getShortAddress = (publicKey: string | null): string => {
  if (!publicKey) return '';
  if (publicKey.length <= 12) return publicKey;
  return `${publicKey.slice(0, 6)}...${publicKey.slice(-6)}`;
};

export const freighterService = {
  async isFreighterAvailable(): Promise<boolean> {
    try {
      const response = await freighterIsConnected();
      return Boolean(response.isConnected && !response.error);
    } catch {
      return false;
    }
  },

  async connectWallet(): Promise<FreighterConnection> {
    const available = await this.isFreighterAvailable();
    if (!available) {
      throw new Error('Freighter extension is not installed or not available in this browser.');
    }

    const accessResponse = assertNoFreighterError(
      await requestAccess(),
      'Unable to connect Freighter wallet.'
    );

    if (!accessResponse.address) {
      throw new Error('Unable to read public key from Freighter.');
    }

    const network = await this.getNetwork();

    localStorage.setItem(CONNECTED_STORAGE_KEY, 'true');

    return {
      publicKey: accessResponse.address,
      network,
      isTestnet: isNetworkTestnet(network),
      isExpectedNetwork: isNetworkExpected(network),
    };
  },

  async getPublicKey(): Promise<string> {
    const response = assertNoFreighterError(
      await freighterGetAddress(),
      'Unable to read public key from Freighter.'
    );

    if (!response.address) {
      throw new Error('Unable to read public key from Freighter.');
    }

    return response.address;
  },

  async getNetwork(): Promise<FreighterNetwork> {
    const response = assertNoFreighterError(
      await getNetworkDetails(),
      'Unable to read Freighter network.'
    );

    return toFreighterNetwork(response);
  },

  async isTestnet(): Promise<boolean> {
    const network = await this.getNetwork();
    return isNetworkTestnet(network);
  },

  async isExpectedNetwork(): Promise<boolean> {
    const network = await this.getNetwork();
    return isNetworkExpected(network);
  },

  async requireExpectedNetwork(): Promise<FreighterNetwork> {
    const network = await this.getNetwork();
    if (!isNetworkExpected(network)) {
      throw new Error(`Freighter is connected to ${network.network || 'an unknown network'}, but Nexus is configured for ${NETWORK_DISPLAY_NAME}.`);
    }
    return network;
  },

  async signTransaction(
    transactionXdr: string,
    networkPassphrase?: string,
    signerAddress?: string
  ): Promise<SignedTransaction> {
    const passphrase = networkPassphrase ?? (await this.getNetwork()).networkPassphrase;
    const walletNetwork = await this.getNetwork();
    if (walletNetwork.networkPassphrase !== passphrase) {
      throw new Error(`Freighter is connected to ${walletNetwork.network || 'an unknown network'}, but this transaction targets ${NETWORK_DISPLAY_NAME}.`);
    }
    const signingOptions = signerAddress
      ? { networkPassphrase: passphrase, address: signerAddress }
      : { networkPassphrase: passphrase };
    const response = assertNoFreighterError(
      await freighterSignTransaction(transactionXdr, signingOptions),
      'Unable to sign transaction with Freighter.'
    );

    if (!response.signedTxXdr) {
      throw new Error('Freighter did not return a signed transaction.');
    }

    return {
      signedTxXdr: response.signedTxXdr,
      signerAddress: response.signerAddress,
    };
  },

  disconnectWallet(): void {
    localStorage.removeItem(CONNECTED_STORAGE_KEY);
  },

  hasSavedConnection(): boolean {
    return localStorage.getItem(CONNECTED_STORAGE_KEY) === 'true';
  },

  watchWalletChanges(
    callback: (connection: FreighterConnection | null, error?: Error) => void
  ): { stop: () => void } {
    const watcher = new WatchWalletChanges();
    const response = watcher.watch(({ address, network, networkPassphrase, error }) => {
      if (error) {
        callback(null, normalizeError(error, 'Unable to watch Freighter wallet changes.'));
        return;
      }
      if (!address) {
        callback(null);
        return;
      }
      const details: FreighterNetwork = {
        network,
        networkUrl: '',
        networkPassphrase,
      };
      callback({
        publicKey: address,
        network: details,
        isTestnet: isNetworkTestnet(details),
        isExpectedNetwork: isNetworkExpected(details),
      });
    });
    if (response.error) {
      callback(null, normalizeError(response.error, 'Unable to watch Freighter wallet changes.'));
    }
    return { stop: () => watcher.stop() };
  },
};
