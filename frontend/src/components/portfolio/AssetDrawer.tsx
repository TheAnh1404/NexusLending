import React from 'react';
import { Drawer, Typography } from 'antd';
import { useAppContext } from '../../app/AppContext';
import { useWallet } from '../../hooks/useWallet';
import { filterWalletActivities } from '../../utils/activity';
import { formatCurrency } from '../../utils/finance';
import { getConnectedWalletAddress } from '../../utils/wallet';

const { Title, Text } = Typography;

interface AssetDrawerProps {
  open: boolean;
  asset: {
    symbol: string;
    walletBalance: number;
    available: number;
    locked: number;
    lent: number;
    borrowed: number;
    usdValue: number;
    price: number;
  } | null;
  onClose: () => void;
}

export const AssetDrawer: React.FC<AssetDrawerProps> = ({ open, asset, onClose }) => {
  const { transactions, loans, loanOffers, wallet } = useAppContext();
  const { publicKey } = useWallet();
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);

  const assetTransactions = React.useMemo(() => {
    if (!asset) return [];
    return filterWalletActivities(transactions, connectedWalletAddress, loans, loanOffers)
      .filter((tx) => tx.asset === asset.symbol)
      .slice(0, 5);
  }, [asset, connectedWalletAddress, loanOffers, loans, transactions]);

  if (!asset) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={460}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: asset.symbol === 'USDC' ? '#2775ca' : '#14b8a6',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {asset.symbol.slice(0, 1)}
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>{asset.symbol} Breakdown</span>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
              1 {asset.symbol} = ${asset.price.toFixed(4)} USD
            </div>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Total USD Value Header */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            padding: 20,
            borderRadius: 14,
            border: '1px solid var(--border-light, #e2e8f0)',
            textAlign: 'center',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>Total {asset.symbol} Value</Text>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 900, color: 'var(--primary-color, #4f46e5)' }}>
            ${asset.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Title>
        </div>

        {/* Detailed Breakdown List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
            <Text type="secondary">Wallet Balance</Text>
            <Text strong>{asset.walletBalance.toLocaleString()} {asset.symbol}</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
            <Text type="secondary">Available Liquidity</Text>
            <Text strong style={{ color: 'var(--success-color)' }}>{asset.available.toLocaleString()} {asset.symbol}</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
            <Text type="secondary">Locked Collateral</Text>
            <Text strong>{asset.locked > 0 ? `${asset.locked.toLocaleString()} ${asset.symbol}` : '-'}</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
            <Text type="secondary">Used as Collateral</Text>
            <Text strong>{asset.locked > 0 ? `${asset.locked.toLocaleString()} ${asset.symbol}` : 'None'}</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
            <Text type="secondary">Active Borrowed</Text>
            <Text strong style={{ color: 'var(--danger-color)' }}>
              {asset.borrowed > 0 ? formatCurrency(asset.borrowed, asset.symbol) : 'None'}
            </Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
            <Text type="secondary">Active Lending Positions</Text>
            <Text strong style={{ color: 'var(--success-color)' }}>
              {asset.lent > 0 ? formatCurrency(asset.lent, asset.symbol) : 'None'}
            </Text>
          </div>
        </div>

        {/* Transaction History for Asset */}
        <div>
          <Title level={5} style={{ margin: '12px 0 12px 0', fontWeight: 700 }}>
            Recent Asset Activity
          </Title>

          {assetTransactions.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 13 }}>No recent transactions for {asset.symbol}.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {assetTransactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    padding: 10,
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    borderRadius: 8,
                    fontSize: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{tx.type.replace(/_/g, ' ')}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tx.details}</div>
                  </div>
                  <Text strong>{tx.amount > 0 ? `${tx.amount} ${tx.asset}` : '-'}</Text>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};
