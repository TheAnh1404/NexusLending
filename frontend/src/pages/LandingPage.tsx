import React from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { ProblemSection } from '../components/landing/ProblemSection';
import { SolutionSection } from '../components/landing/SolutionSection';
import { EscrowProtectionSection } from '../components/landing/EscrowProtectionSection';
import { HealthFactorSection } from '../components/landing/HealthFactorSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { WhyStellarSection } from '../components/landing/WhyStellarSection';
import { LandingCTA } from '../components/landing/LandingCTA';
import { useAppContext } from '../app/AppContext';
import { Table, Typography, Button, Tag } from 'antd';
import { ExternalLink } from 'lucide-react';
import { formatAddress } from '../utils/finance';

const { Title, Paragraph, Text } = Typography;

export const LandingPage: React.FC = () => {
  const { transactions } = useAppContext();
  
  // Filter recent confirmed transactions (only status === SUCCESS or mock transactions)
  const recentTxs = transactions
    .filter((tx) => !tx.status || tx.status === 'SUCCESS')
    .slice(0, 5);

  const columns = [
    {
      title: 'Action Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        let color = 'blue';
        if (type === 'LIQUIDATE') color = 'red';
        if (type === 'ACTIVATE_LOAN') color = 'green';
        if (type === 'FULL_REPAY' || type === 'PARTIAL_REPAY') color = 'gold';
        return <Tag color={color} style={{ fontWeight: 600 }}>{type.replace(/_/g, ' ')}</Tag>;
      },
    },
    {
      title: 'User Wallet',
      dataIndex: 'user',
      key: 'user',
      render: (user: string) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{formatAddress(user)}</Text>,
    },
    {
      title: 'Transaction Hash',
      dataIndex: 'txHash',
      key: 'txHash',
      render: (txHash: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)' }} copyable={{ text: txHash }}>
          {txHash ? `${txHash.slice(0, 8)}...${txHash.slice(-8)}` : 'Not available'}
        </Text>
      ),
    },
    {
      title: 'Ledger',
      dataIndex: 'ledger',
      key: 'ledger',
      render: (ledger?: number) => <Text>{ledger ?? '-'}</Text>,
    },
    {
      title: 'Stellar Expert',
      key: 'link',
      render: (_: any, record: any) => {
        if (!record.explorerUrl && !record.txHash) return <Text type="secondary">No confirmed record</Text>;
        const url = record.explorerUrl ?? `https://stellar.expert/explorer/testnet/tx/${record.txHash}`;
        return (
          <Button
            type="link"
            icon={<ExternalLink size={12} />}
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{ padding: 0, height: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            View
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', overflowX: 'hidden' }}>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <EscrowProtectionSection />
      <HealthFactorSection />
      <HowItWorksSection />
      
      {/* Recent Confirmed Transactions Section */}
      <section style={{ padding: '60px 24px', backgroundColor: '#FFFFFF', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span style={{
              background: 'rgba(47, 128, 237, 0.08)',
              color: 'var(--primary-color)',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Ledger Registry
            </span>
            <Title level={2} style={{ fontWeight: 800, marginTop: '16px', marginBottom: '8px' }}>
              Recent Confirmed Transactions
            </Title>
            <Paragraph style={{ color: 'var(--text-muted)' }}>
              Real-time ledger events processed by the Nexus indexer from the Stellar Testnet blockchain.
            </Paragraph>
          </div>
          
          <Table
            dataSource={recentTxs}
            columns={columns}
            rowKey="id"
            pagination={false}
            bordered
            style={{
              background: '#FFFFFF',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          />
        </div>
      </section>

      <WhyStellarSection />
      <LandingCTA />
    </div>
  );
};
