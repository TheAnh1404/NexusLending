import React from 'react';
import { LendingProvider, useLending } from '../contexts/LendingContext';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LendingProvider>{children}</LendingProvider>
);

// oxlint-disable-next-line react/only-export-components
export const useAppContext = useLending;

