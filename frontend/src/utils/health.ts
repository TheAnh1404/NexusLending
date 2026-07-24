import React from 'react';
import { ShieldCheck, AlertTriangle, Flame } from 'lucide-react';

export const getHealthCategory = (hf: number, status?: string) => {
  if (status === 'Liquidated' || status === 'Defaulted') {
    return { label: 'Liquidated', color: 'red', bg: '#fef2f2', border: '#fecaca', icon: React.createElement(Flame, { size: 12 }) };
  }
  if (hf < 1.0 || status === 'LiquidationPlanning' || status === 'Warning') {
    return { label: 'At Risk', color: 'red', bg: '#fef2f2', border: '#fecaca', icon: React.createElement(Flame, { size: 12 }) };
  }
  if (hf < 1.2) {
    return { label: 'At Risk', color: 'red', bg: '#fef2f2', border: '#fecaca', icon: React.createElement(Flame, { size: 12 }) };
  }
  if (hf <= 1.4) {
    return { label: 'Attention', color: 'gold', bg: '#fffbe6', border: '#ffe58f', icon: React.createElement(AlertTriangle, { size: 12 }) };
  }
  return { label: 'Safe', color: 'green', bg: '#f6ffed', border: '#b7eb8f', icon: React.createElement(ShieldCheck, { size: 12 }) };
};
