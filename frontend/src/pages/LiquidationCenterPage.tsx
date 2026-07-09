import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { formatCurrency, formatAddress, isLiquidatable, isOpenLoanStatus } from '../utils/finance';
import { EmptyState } from '../components/common/CommonStates';
import { RiskBadge } from '../components/common/RiskBadge';
import { motion } from 'framer-motion';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Typography,
  Tag,
  Input,
  Select,
  Tooltip,
  Badge,
  Progress,
  Divider,
  message,
  Space,
} from 'antd';
import {
  Flame,
  AlertTriangle,
  TrendingDown,
  Coins,
  Search,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const LiquidationCenterPage: React.FC = () => {
  const { loans, oraclePrices } = useAppContext();
  const navigate = useNavigate();

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;

  // Filter loans that satisfy protocol liquidation rules.
  const liquidatableLoans = loans.filter(
    (l) => isOpenLoanStatus(l.status) && isLiquidatable(l.healthFactor, l.status)
  );

  // Apply filters
  const filteredLoans = liquidatableLoans.filter((item) => {
    const matchesSearch =
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.borrower.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAsset = selectedAsset === 'ALL' || item.asset.toUpperCase() === selectedAsset.toUpperCase();
    return matchesSearch && matchesAsset;
  });

  // Statistics
  const count = liquidatableLoans.length;
  const totalDebtAtRisk = liquidatableLoans.reduce((sum, l) => sum + l.outstandingDebt, 0);

  const avgHF =
    count > 0 ? liquidatableLoans.reduce((sum, l) => sum + l.healthFactor, 0) / count : 0;

  // Total liquidation bonus value in USD available to be claimed
  const totalBonusVal = liquidatableLoans.reduce((sum, l) => {
    const debtToLiquidate = l.outstandingDebt * 0.5; // assume 50% partial liquidation
    const bonusVal = debtToLiquidate * (l.liquidationBonus / 100);
    return sum + bonusVal;
  }, 0);

  // Copy handler
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    message.success('Copied to clipboard');
  };

  const columns = [
    {
      title: 'Contract / Loan ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => (
        <Space size={4}>
          <Text strong style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{formatAddress(text)}</Text>
          <Button
            type="text"
            size="small"
            icon={copiedId === text ? <Check size={12} style={{ color: 'var(--success-color)' }} /> : <Copy size={12} />}
            onClick={() => handleCopyText(text, text)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        </Space>
      ),
    },
    {
      title: 'Borrower',
      dataIndex: 'borrower',
      key: 'borrower',
      render: (text: string) => (
        <Tooltip title={text}>
          <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{formatAddress(text)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Outstanding Debt',
      dataIndex: 'outstandingDebt',
      key: 'outstandingDebt',
      render: (debt: number, record: any) => (
        <div>
          <Text strong style={{ fontSize: '14px', color: 'var(--danger-color)' }}>{formatCurrency(debt, record.asset)}</Text>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>USDC Settled Valuation</div>
        </div>
      ),
    },
    {
      title: 'Locked Collateral',
      dataIndex: 'collateralAmount',
      key: 'collateralAmount',
      render: (amount: number, record: any) => (
        <div>
          <Text strong style={{ fontSize: '14px' }}>{amount.toLocaleString()} {record.collateralAsset}</Text>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Valued: ${ (amount * xlmPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } USD
          </div>
        </div>
      ),
    },
    {
      title: 'Health Factor',
      dataIndex: 'healthFactor',
      key: 'healthFactor',
      render: (hf: number) => {
        const percentVal = Math.min((hf / 3) * 100, 100);
        return (
          <div style={{ minWidth: '110px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <Text strong style={{ fontSize: '13px', color: 'var(--danger-color)' }}>{hf.toFixed(2)}</Text>
              <RiskBadge healthFactor={hf} />
            </div>
            <Progress 
              percent={percentVal} 
              showInfo={false} 
              strokeColor="var(--danger-color)" 
              size="small"
              style={{ margin: 0 }}
            />
          </div>
        );
      },
    },
    {
      title: 'Bonus Incentive',
      dataIndex: 'liquidationBonus',
      key: 'liquidationBonus',
      render: (bonus: number) => (
        <Tag color="green" style={{ fontWeight: 600, border: 'none', borderRadius: '4px' }}>
          +{bonus}% Collateral
        </Tag>
      ),
    },
    {
      title: 'Trigger Reason',
      key: 'reason',
      render: (_: any, record: any) => {
        if (record.status === 'Defaulted') {
          return <Tag color="volcano" style={{ border: 'none', fontWeight: 600 }}>7-Day Grace Default</Tag>;
        }
        if (record.status === 'Expired') {
          return <Tag color="red" style={{ border: 'none', fontWeight: 600 }}>Overdue + HF &lt; 1.2</Tag>;
        }
        return <Tag color="red" style={{ border: 'none', fontWeight: 600 }}>Under-Collateral (HF &lt; 1.2)</Tag>;
      },
    },
    {
      title: 'Action Ledger',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          type="primary"
          danger
          onClick={() => navigate(`/app/liquidation/${record.id}`)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px', fontSize: '13px' }}
        >
          <Flame size={14} /> Review
        </Button>
      ),
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ display: 'flex', flexDirection: 'column', gap: '28px', paddingBottom: '40px' }}
    >
      
      {/* 1. Header Banner */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #450a0a 0%, #1e1b4b 50%, #0f172a 100%)', 
          borderRadius: 'var(--radius-xl)', 
          padding: '32px',
          boxShadow: 'var(--shadow-premium)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-30%', left: '10%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(79, 70, 229, 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Space direction="vertical" size={4}>
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} /> Arbitrage & Risk Clearing
          </span>
          <Title level={1} style={{ margin: 0, color: '#ffffff', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '32px', letterSpacing: '-0.03em' }}>
            Liquidation Center
          </Title>
          <Paragraph style={{ margin: '8px 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '15px', maxWidth: '750px', lineHeight: 1.5 }}>
            Monitor and execute partial liquidations on stressed contract positions. Earn a prompt discount bonus by repaying up to 50% close factor USDC debt in exchange for escrowed collateral.
          </Paragraph>
        </Space>
      </div>

      {/* 2. Top statistics cards */}
      <Row gutter={[16, 16]}>
        
        {/* Card 1 */}
        <Col xs={24} sm={12} lg={6}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--danger-color)' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Stressed Positions</Text>
                  <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {count}
                    {count > 0 && (
                      <span 
                        style={{ width: '8px', height: '8px', backgroundColor: 'var(--danger-color)', borderRadius: '50%', display: 'inline-block' }} 
                        className="pulse-animation"
                      />
                    )}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger-color)' }}>
                  <Flame size={18} />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {count > 0 ? 'Urgent action required' : 'Protocol health is nominal'}
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 2 */}
        <Col xs={24} sm={12} lg={6}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid #f59e0b' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Debt at Risk</Text>
                  <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {formatCurrency(totalDebtAtRisk, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }}>
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Value of loans under health threshold
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 3 */}
        <Col xs={24} sm={12} lg={6}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--success-color)' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Est. Arbitrage Profit</Text>
                  <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--success-color)' }}>
                    {formatCurrency(totalBonusVal, 'USDC')}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--success-color)' }}>
                  <Coins size={18} />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Liquidation incentives available to claim
              </div>
            </Card>
          </motion.div>
        </Col>

        {/* Card 4 */}
        <Col xs={24} sm={12} lg={6}>
          <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <Card style={{ borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--primary-color)' }} styles={{ body: { padding: '20px' } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Avg Stressed Health</Text>
                  <Title level={2} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                    {count > 0 ? avgHF.toFixed(2) : 'N/A'}
                  </Title>
                </div>
                <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.08)', color: 'var(--primary-color)' }}>
                  <TrendingDown size={18} />
                </div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Average HF of distressed positions
              </div>
            </Card>
          </motion.div>
        </Col>

      </Row>

      {/* 3. Stressed Positions Ledger */}
      <Card 
        styles={{ body: { padding: '24px' } }}
        style={{ 
          borderRadius: 'var(--radius-lg)', 
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Table Header toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <Input
                placeholder="Search Borrower address, Contract ID..."
                prefix={<Search size={15} style={{ color: 'var(--text-muted)' }} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', maxWidth: '320px', borderRadius: 'var(--radius-sm)' }}
                allowClear
              />
              
              <Select
                value={selectedAsset}
                onChange={(val) => setSelectedAsset(val)}
                style={{ width: '140px' }}
                options={[
                  { value: 'ALL', label: 'All Collateral' },
                  { value: 'USDC', label: 'USDC Stable' },
                  { value: 'XLM', label: 'Stellar XLM' },
                ]}
              />

              {(searchTerm || selectedAsset !== 'ALL') && (
                <Button 
                  type="text" 
                  size="small" 
                  onClick={() => { setSearchTerm(''); setSelectedAsset('ALL'); }}
                  style={{ fontSize: '12px', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Reset Filters
                </Button>
              )}
            </div>

            <Badge count={filteredLoans.length} color="var(--danger-color)" style={{ alignSelf: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', paddingRight: '8px' }}>Ledger Records</span>
            </Badge>
          </div>

          <Divider style={{ margin: 0 }} />

          {count === 0 ? (
            <EmptyState
              title="No Stressed Positions"
              description="All contracts are healthy. Borrowers are matching safe health factor thresholds (>1.20) or within active payment windows."
            />
          ) : filteredLoans.length === 0 ? (
            <EmptyState
              title="No matching records"
              description="No stressed contracts found matching your search term and filters."
            />
          ) : (
            <Table 
              columns={columns} 
              dataSource={filteredLoans.map((item) => ({ ...item, key: item.id }))} 
              pagination={{ pageSize: 10 }}
              style={{ overflowX: 'auto' }}
            />
          )}

        </div>
      </Card>

      {/* 4. Safety & Isolated Escrow Parameters Info */}
      <div 
        style={{ 
          background: 'rgba(239, 68, 68, 0.02)', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--radius-lg)', 
          padding: '20px 24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start'
        }}
      >
        <AlertTriangle size={20} style={{ color: 'var(--danger-color)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <Text strong style={{ fontSize: '14px', color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
            Liquidation close factor parameters & liquidator bonus incentives
          </Text>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Nexus operates on strict isolated smart contracts. When a position qualifies for liquidation (Health Factor &lt; 1.20 or Grace Period expiry), 
            liquidators execute code to repay up to <strong>50% Close Factor debt</strong>. The contract automatically compensates the liquidator by releasing 
            an equivalent value of locked XLM/collateral, plus the <strong>Liquidation Bonus incentive</strong> (credited directly from the borrower's escrow vault).
            This maintains pool balance and guarantees swift debt clearing.
          </span>
        </div>
      </div>

    </motion.div>
  );
};
