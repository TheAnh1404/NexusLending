import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { usersApi } from '../services/api/users.api';
import {
  expectedNetworkLabel,
  freighterService,
  getShortAddress,
  isNetworkExpected,
  isNetworkTestnet,
  type FreighterConnection,
} from '../services/wallet/freighter.service';

interface WalletContextState {
  isConnected: boolean;
  publicKey: string | null;
  shortAddress: string;
  network: string | null;
  isTestnet: boolean;
  isExpectedNetwork: boolean;
  isLoading: boolean;
  error: string | null;
}

interface WalletContextValue extends WalletContextState {
  connect: () => Promise<FreighterConnection>;
  disconnect: () => void;
  refreshWallet: () => Promise<void>;
}

const initialState: WalletContextState = {
  isConnected: false,
  publicKey: null,
  shortAddress: '',
  network: null,
  isTestnet: false,
  isExpectedNetwork: false,
  isLoading: true,
  error: null,
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'Wallet action failed.');

const networkLabel = (network: string): string => {
  if (network === 'TESTNET') return 'Stellar Testnet';
  if (network === 'PUBLIC') return 'Stellar Mainnet';
  if (network === 'FUTURENET') return 'Stellar Futurenet';
  return network || 'Unknown Network';
};

const stateFromConnection = (connection: FreighterConnection): WalletContextState => ({
  isConnected: true,
  publicKey: connection.publicKey,
  shortAddress: getShortAddress(connection.publicKey),
  network: networkLabel(connection.network.network),
  isTestnet: connection.isTestnet,
  isExpectedNetwork: connection.isExpectedNetwork,
  isLoading: false,
  error: connection.isExpectedNetwork ? null : `Freighter is connected to ${networkLabel(connection.network.network)}, but Nexus is configured for ${expectedNetworkLabel}.`,
});

const ensureConnectedUser = async (connection: FreighterConnection): Promise<void> => {
  if (!connection.isExpectedNetwork) return;
  await usersApi.ensureExists(connection.publicKey);
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletContextState>(initialState);

  const refreshWallet = useCallback(async () => {
    setWallet((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const available = await freighterService.isFreighterAvailable();
      if (!available) {
        freighterService.disconnectWallet();
        setWallet({
          ...initialState,
          isLoading: false,
          error: 'Freighter extension is not installed or not available in this browser.',
        });
        return;
      }

      const publicKey = await freighterService.getPublicKey();
      const network = await freighterService.getNetwork();
      const isTestnet = isNetworkTestnet(network);
      const isExpectedNetwork = isNetworkExpected(network);

      const connection = {
        publicKey,
        network,
        isTestnet,
        isExpectedNetwork,
      };
      await ensureConnectedUser(connection);
      setWallet(stateFromConnection(connection));
    } catch (error) {
      freighterService.disconnectWallet();
      setWallet({
        ...initialState,
        isLoading: false,
        error: errorMessage(error),
      });
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem('nexus_mock_connected');
    localStorage.removeItem('nexus_mock_address');

    if (freighterService.hasSavedConnection()) {
      void refreshWallet();
      return;
    }

    setWallet((prev) => ({ ...prev, isLoading: false }));
  }, [refreshWallet]);

  useEffect(() => {
    if (!wallet.isConnected && !freighterService.hasSavedConnection()) return;

    const watcher = freighterService.watchWalletChanges((connection, watchError) => {
      if (watchError) {
        setWallet((prev) => ({ ...prev, error: errorMessage(watchError), isLoading: false }));
        return;
      }
      if (!connection) return;
      setWallet((prev) => ({ ...prev, isLoading: true, error: null }));
      void ensureConnectedUser(connection)
        .then(() => setWallet(stateFromConnection(connection)))
        .catch((syncError) => {
          freighterService.disconnectWallet();
          setWallet({
            ...initialState,
            isLoading: false,
            error: errorMessage(syncError),
          });
        });
    });

    return () => watcher.stop();
  }, [wallet.isConnected]);

  const connect = useCallback(async () => {
    setWallet((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const connection = await freighterService.connectWallet();
      await ensureConnectedUser(connection);
      setWallet(stateFromConnection(connection));
      return connection;
    } catch (error) {
      const message = errorMessage(error);
      freighterService.disconnectWallet();
      setWallet((prev) => ({
        ...prev,
        isConnected: false,
        publicKey: null,
        shortAddress: '',
        network: null,
        isTestnet: false,
        isExpectedNetwork: false,
        isLoading: false,
        error: message,
      }));
      throw new Error(message);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem('nexus_mock_connected');
    localStorage.removeItem('nexus_mock_address');
    localStorage.removeItem('nexus_data_mode');
    freighterService.disconnectWallet();
    setWallet({
      ...initialState,
      isLoading: false,
    });
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      ...wallet,
      connect,
      disconnect,
      refreshWallet,
    }),
    [connect, disconnect, refreshWallet, wallet]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

// oxlint-disable-next-line react/only-export-components
export const useWalletContext = (): WalletContextValue => {
  const context = React.useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
