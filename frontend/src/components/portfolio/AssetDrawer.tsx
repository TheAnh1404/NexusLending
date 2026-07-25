import React, { useState } from 'react';
import { Modal, Typography, Segmented, Tag, Button, Row, Col } from 'antd';
import { Wallet, Lock, TrendingUp, ArrowDownRight, Activity, X, ShieldCheck, PieChart, Coins } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'breakdown' | 'activity'>('breakdown');
  const connectedWalletAddress = getConnectedWalletAddress(publicKey, wallet.address);

  const assetTransactions = React.useMemo(() => {
    if (!asset) return [];
    return filterWalletActivities(transactions, connectedWalletAddress, loans, loanOffers)
      .filter((tx) => tx.asset === asset.symbol)
      .slice(0, 6);
  }, [asset, connectedWalletAddress, loanOffers, loans, transactions]);

  if (!asset) return null;

  // Breakdown metrics
  const walletValueUsd = asset.walletBalance * asset.price;
  const lockedValueUsd = asset.locked * asset.price;
  const lentValueUsd = asset.lent * asset.price;
  const borrowedValueUsd = asset.borrowed * asset.price;
  const totalCalculatedUsd = walletValueUsd + lockedValueUsd + lentValueUsd;

  const pctWallet = totalCalculatedUsd > 0 ? (walletValueUsd / totalCalculatedUsd) * 100 : 0;
  const pctLent = totalCalculatedUsd > 0 ? (lentValueUsd / totalCalculatedUsd) * 100 : 0;
  const pctLocked = totalCalculatedUsd > 0 ? (lockedValueUsd / totalCalculatedUsd) * 100 : 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={620}
      centered
      closeIcon={<X size={18} style={{ color: 'var(--text-muted)' }} />}
      styles={{
        mask: {
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
        },
        body: {
          padding: '0',
        },
      }}
      style={{
        borderRadius: '20px',
      }}
    >
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: asset.symbol === 'USDC' ? '#2775ca' : '#14b8a6',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 20,
              boxShadow:
                asset.symbol === 'USDC'
                  ? '0 8px 16px -4px rgba(39, 117, 202, 0.4)'
                  : '0 8px 16px -4px rgba(20, 184, 166, 0.4)',
            }}
          >
            {asset.symbol.slice(0, 1)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
                {asset.symbol} Asset Breakdown
              </Title>
              <Tag color="processing" style={{ borderRadius: 12, fontSize: 10, padding: '0 8px', fontWeight: 600 }}>
                ● Live Oracle
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              1 {asset.symbol} = ${asset.price.toFixed(4)} USD
            </Text>
          </div>
        </div>
      </div>

      {/* Hero Asset Value Card & Distribution Bar */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.06) 0%, rgba(20, 184, 166, 0.06) 100%)',
          padding: '18px 20px',
          borderRadius: 16,
          border: '1px solid rgba(79, 70, 229, 0.12)',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Asset Value
            </Text>
            <Title level={2} style={{ margin: '2px 0 0 0', fontWeight: 900, color: 'var(--text-primary, #0f172a)' }}>
              ${asset.usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Title>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-color, #4f46e5)' }}>
              {(asset.walletBalance + asset.locked + asset.lent).toLocaleString()} {asset.symbol}
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>Total Portfolio Units</Text>
          </div>
        </div>

        {/* Visual Bar Distribution Chart */}
        <div
          style={{
            height: 10,
            borderRadius: 6,
            backgroundColor: 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
            display: 'flex',
            gap: 2,
          }}
        >
          {pctWallet > 0 && (
            <div
              style={{
                width: `${pctWallet}%`,
                backgroundColor: '#4f46e5',
                height: '100%',
                transition: 'width 0.3s ease',
              }}
              title={`Available: ${pctWallet.toFixed(1)}%`}
            />
          )}
          {pctLent > 0 && (
            <div
              style={{
                width: `${pctLent}%`,
                backgroundColor: '#10b981',
                height: '100%',
                transition: 'width 0.3s ease',
              }}
              title={`Lending: ${pctLent.toFixed(1)}%`}
            />
          )}
          {pctLocked > 0 && (
            <div
              style={{
                width: `${pctLocked}%`,
                backgroundColor: '#f59e0b',
                height: '100%',
                transition: 'width 0.3s ease',
              }}
              title={`Collateral: ${pctLocked.toFixed(1)}%`}
            />
          )}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4f46e5' }} />
            <Text type="secondary">Wallet ({pctWallet.toFixed(0)}%)</Text>
          </div>
          {pctLent > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} />
              <Text type="secondary">Lending ({pctLent.toFixed(0)}%)</Text>
            </div>
          )}
          {pctLocked > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <Text type="secondary">Collateral ({pctLocked.toFixed(0)}%)</Text>
            </div>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <Segmented
        block
        value={activeTab}
        onChange={(val) => setActiveTab(val as 'breakdown' | 'activity')}
        options={[
          {
            label: (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <PieChart size={14} /> Allocation Breakdown
              </div>
            ),
            value: 'breakdown',
          },
          {
            label: (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Activity size={14} /> Recent Activity ({assetTransactions.length})
              </div>
            ),
            value: 'activity',
          },
        ]}
        style={{ marginBottom: 16 }}
      />

      {/* Tab 1: Detailed Allocation Grid */}
      {activeTab === 'breakdown' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row gutter={[12, 12]}>
            {/* Wallet Balance */}
            <Col span={12}>
              <div
                style={{
                  padding: 14,
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  borderRadius: 12,
                  border: '1px solid var(--border-light, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: 'rgba(79, 70, 229, 0.1)',
                      color: '#4f46e5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Wallet size={15} />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>Wallet Balance</Text>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {asset.walletBalance.toLocaleString()} {asset.symbol}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  ${walletValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </div>
              </div>
            </Col>

            {/* Available Liquidity */}
            <Col span={12}>
              <div
                style={{
                  padding: 14,
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  borderRadius: 12,
                  border: '1px solid var(--border-light, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: 'var(--success-color, #10b981)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Coins size={15} />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>Available Liquidity</Text>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--success-color, #10b981)' }}>
                  {asset.available.toLocaleString()} {asset.symbol}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Ready to lend or swap
                </div>
              </div>
            </Col>

            {/* Locked Collateral */}
            <Col span={12}>
              <div
                style={{
                  padding: 14,
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  borderRadius: 12,
                  border: '1px solid var(--border-light, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      color: '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Lock size={15} />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>Locked Collateral</Text>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  {asset.locked > 0 ? `${asset.locked.toLocaleString()} ${asset.symbol}` : '0'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {asset.locked > 0 ? `${lockedValueUsd.toFixed(2)} USD in Escrow` : 'No collateral locked'}
                </div>
              </div>
            </Col>

            {/* Active Lending / Yield */}
            <Col span={12}>
              <div
                style={{
                  padding: 14,
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  borderRadius: 12,
                  border: '1px solid var(--border-light, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TrendingUp size={15} />
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>Lending Positions</Text>
                  </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#10b981' }}>
                  {asset.lent > 0 ? formatCurrency(asset.lent, asset.symbol) : '0'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {asset.lent > 0 ? `${lentValueUsd.toFixed(2)} USD earning APR` : 'No active offers'}
                </div>
              </div>
            </Col>
          </Row>

          {/* Active Borrowed Debt Banner */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: asset.borrowed > 0 ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-subtle, #f8fafc)',
              borderRadius: 12,
              border: asset.borrowed > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border-light, #e2e8f0)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: asset.borrowed > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                  color: asset.borrowed > 0 ? '#ef4444' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowDownRight size={16} />
              </div>
              <div>
                <Text strong style={{ fontSize: 13 }}>Active Borrowed Debt</Text>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {asset.borrowed > 0 ? `${borrowedValueUsd.toFixed(2)} USD outstanding debt` : 'Zero active debt for this asset'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontWeight: 800, fontSize: 15, color: asset.borrowed > 0 ? '#ef4444' : 'inherit' }}>
              {asset.borrowed > 0 ? formatCurrency(asset.borrowed, asset.symbol) : '0'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Activity List */}
      {activeTab === 'activity' && (
        <div style={{ minHeight: 180 }}>
          {assetTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <ShieldCheck size={32} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: 8 }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No recent transactions recorded for {asset.symbol}.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {assetTransactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    borderRadius: 10,
                    border: '1px solid var(--border-light, #e2e8f0)',
                    fontSize: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        color: 'var(--primary-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      <Activity size={15} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{tx.type.replace(/_/g, ' ')}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{tx.details}</div>
                    </div>
                  </div>
                  <Text strong style={{ fontSize: 13 }}>
                    {tx.amount > 0 ? `${tx.amount} ${tx.asset}` : '-'}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Controls */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--border-light, #e2e8f0)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}
      >
        <Button onClick={onClose} style={{ borderRadius: 8, fontWeight: 600 }}>
          Close
        </Button>
      </div>
    </Modal>
  );
};

