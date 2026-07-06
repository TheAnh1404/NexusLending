import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { formatCurrency, isOpenLoanStatus } from '../utils/finance';
import { StatisticCard } from '../components/common/StatisticCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import { HealthFactorGauge } from '../components/common/HealthFactorGauge';
import { EmptyState } from '../components/common/CommonStates';
import { AddCollateralModal } from '../components/common/AddCollateralModal';
import { PartialRepaymentModal } from '../components/common/PartialRepaymentModal';
import {
  Card,
  Row,
  Col,
  Button,
  Form,
  Space,
  Typography,
} from 'antd';
import {
  ShieldCheck,
  Calendar,
  DollarSign,
  TrendingUp,
  Layers,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const BorrowerDashboardPage: React.FC = () => {
  const { wallet, loans, oraclePrices, activateLoan, addCollateral, repayLoan } = useAppContext();
  const navigate = useNavigate();

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const usdcPrice = oraclePrices.find((p) => p.asset === 'USDC')?.price || 1.0;

  // Filter loans belonging to this borrower
  const borrowerLoans = loans.filter(
    (l) => l.borrower === wallet.address && isOpenLoanStatus(l.status)
  );
  const activeDebtLoans = borrowerLoans.filter((loan) => loan.status !== 'PendingCollateral');

  // Statistics
  const activeLoansCount = borrowerLoans.length;
  const outstandingDebt = activeDebtLoans.reduce((sum, l) => sum + l.outstandingDebt, 0);
  const collateralLockedVal = activeDebtLoans.reduce(
    (sum, l) => sum + l.collateralAmount * xlmPrice,
    0
  );
  const avgHF =
    activeDebtLoans.length > 0
      ? activeDebtLoans.reduce((sum, l) => sum + l.healthFactor, 0) / activeDebtLoans.length
      : 99.99;

  // Find next payment date
  const nextPaymentDate =
    activeDebtLoans.length > 0
      ? activeDebtLoans.reduce((earliest, current) => {
          return new Date(current.dueDate) < new Date(earliest.dueDate) ? current : earliest;
        }).dueDate
      : null;

  // Modal States
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [collateralModalOpen, setCollateralModalOpen] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);

  const selectedLoan = loans.find((l) => l.id === selectedLoanId);

  // Form states
  const [collateralForm] = Form.useForm();
  const [repayForm] = Form.useForm();

  // Submissions
  const handleAddCollateralSubmit = async (amount: number) => {
    if (!selectedLoanId || amount <= 0) {
      throw new Error('Invalid collateral amount');
    }
    await addCollateral(selectedLoanId, amount);
    setCollateralModalOpen(false);
    collateralForm.resetFields();
  };

  const handleRepaySubmit = async (amount: number, isFullRepay: boolean) => {
    if (!selectedLoanId || amount <= 0) {
      throw new Error('Invalid repayment amount');
    }
    await repayLoan(selectedLoanId, amount, isFullRepay);
    setRepayModalOpen(false);
    repayForm.resetFields();
  };

  const openAddCollateralModal = (loanId: string) => {
    setSelectedLoanId(loanId);
    setCollateralModalOpen(true);
  };

  const openRepayModal = (loanId: string) => {
    setSelectedLoanId(loanId);
    setRepayModalOpen(true);
  };

  const handleActivateLoan = async (loanId: string) => {
    await activateLoan(loanId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div>
        <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
          Borrower Dashboard
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          Manage your active borrowed contracts, add collateral, and repay debts.
        </Paragraph>
      </div>

      {/* Top Statistics */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={5}>
          <StatisticCard title="Active Borrowed Contracts" value={activeLoansCount} icon={<Layers size={22} />} />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <StatisticCard
            title="Total Outstanding Debt"
            value={formatCurrency(outstandingDebt, 'USDC')}
            icon={<DollarSign size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <StatisticCard
            title="Collateral Locked Value"
            value={formatCurrency(collateralLockedVal, 'USDC')}
            icon={<ShieldCheck size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatisticCard
            title="Average Health Factor"
            value={avgHF >= 99.0 ? 'N/A' : avgHF.toFixed(2)}
            icon={<TrendingUp size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <StatisticCard
            title="Next Due Date"
            value={nextPaymentDate ? new Date(nextPaymentDate).toLocaleDateString() : 'N/A'}
            icon={<Calendar size={22} />}
          />
        </Col>
      </Row>

      {/* Loans Section */}
      {activeLoansCount === 0 ? (
        <EmptyState
          title="No borrowed loans yet."
          description="You do not have any active borrows right now. Navigate to the marketplace to accept a loan offer."
          action={
            <Button type="primary" onClick={() => navigate('/app/marketplace')}>
              Browse Marketplace
            </Button>
          }
        />
      ) : (
        <div>
          <Title level={3} style={{ marginBottom: '20px', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Your Active Loans
          </Title>
          <Row gutter={[24, 24]}>
            {borrowerLoans.map((loan) => (
              <Col xs={24} lg={12} key={loan.id}>
                <Card className="card-premium" styles={{ body: { padding: '24px' } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        LOAN ID: {loan.id}
                      </span>
                      <Title level={4} style={{ margin: '4px 0 0 0', fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                        {formatCurrency(loan.amount, 'USDC')} Principal
                      </Title>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <LoanStatusBadge status={loan.status} />
                      <RiskBadge healthFactor={loan.healthFactor} />
                    </div>
                  </div>

                  <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
                    <Col xs={12} sm={8} style={{ textAlign: 'center' }}>
                      <div style={{ padding: '12px', background: 'var(--bg-color)', borderRadius: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>DEBT DUE</Text>
                        <Text strong style={{ fontSize: '15px' }}>{formatCurrency(loan.outstandingDebt, 'USDC')}</Text>
                      </div>
                    </Col>
                    <Col xs={12} sm={8} style={{ textAlign: 'center' }}>
                      <div style={{ padding: '12px', background: 'var(--bg-color)', borderRadius: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>COLLATERAL</Text>
                        <Text strong style={{ fontSize: '15px' }}>{loan.collateralAmount.toLocaleString()} XLM</Text>
                      </div>
                    </Col>
                    <Col xs={24} sm={8} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Space direction="vertical" align="center" size={0}>
                        <HealthFactorGauge value={loan.healthFactor} size={80} />
                      </Space>
                    </Col>
                  </Row>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginBottom: '24px',
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Fixed APR / Duration:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{loan.apr}% APR / {loan.duration} Days</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Maturity Date:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{new Date(loan.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>LTV / Liquidation Threshold:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {((loan.outstandingDebt / (loan.collateralAmount * xlmPrice)) * 100).toFixed(1)}% LTV / {loan.liquidationThreshold}%
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {loan.status === 'PendingCollateral' ? (
                      <Button type="primary" onClick={() => void handleActivateLoan(loan.id)} style={{ flex: 1 }}>
                        Activate Loan
                      </Button>
                    ) : (
                      <>
                        <Button type="primary" onClick={() => openAddCollateralModal(loan.id)} style={{ flex: 1 }}>
                          Add Collateral
                        </Button>
                        <Button onClick={() => openRepayModal(loan.id)} style={{ flex: 1 }}>
                          Repay Debt
                        </Button>
                      </>
                    )}
                    <Button onClick={() => navigate(`/app/loans/${loan.id}`)}>
                      Details
                    </Button>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      <AddCollateralModal
        open={collateralModalOpen}
        loan={selectedLoan}
        wallet={wallet}
        form={collateralForm}
        xlmPrice={xlmPrice}
        usdcPrice={usdcPrice}
        onCancel={() => setCollateralModalOpen(false)}
        onConfirm={handleAddCollateralSubmit}
      />

      <PartialRepaymentModal
        open={repayModalOpen}
        loan={selectedLoan}
        wallet={wallet}
        form={repayForm}
        xlmPrice={xlmPrice}
        usdcPrice={usdcPrice}
        onCancel={() => setRepayModalOpen(false)}
        onConfirm={handleRepaySubmit}
      />
    </div>
  );
};

