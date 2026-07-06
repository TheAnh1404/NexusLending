import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../app/AppContext';
import { calculateInterestAmount, formatCurrency, formatAddress, isOpenLoanStatus } from '../utils/finance';
import { StatisticCard } from '../components/common/StatisticCard';
import { LoanStatusBadge } from '../components/common/LoanStatusBadge';
import { OfferStatusBadge } from '../components/common/OfferStatusBadge';
import { RiskBadge } from '../components/common/RiskBadge';
import { EmptyState } from '../components/common/CommonStates';
import { ConfirmActionModal } from '../components/common/ConfirmActionModal';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Space,
  Typography,
} from 'antd';
import {
  Coins,
  TrendingUp,
  FileBadge,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

export const LenderDashboardPage: React.FC = () => {
  const { wallet, loans, loanOffers, fundOffer, activateOffer, cancelOffer, claimRepayment } = useAppContext();
  const navigate = useNavigate();

  // Filter loans where this user is the lender
  const lenderLoans = loans.filter((l) => l.lender === wallet.address);
  const lenderOffers = loanOffers.filter((offer) => offer.lender === wallet.address);
  const activeOffers = lenderOffers.filter((offer) => offer.status === 'Active');
  const fundingOffers = lenderOffers.filter((offer) => offer.status === 'Funding');

  // Active Lender Loans
  const activeLoans = lenderLoans.filter((l) => isOpenLoanStatus(l.status));
  const activeLoansCount = activeLoans.length;

  // Completed Loans
  const completedLoans = lenderLoans.filter((l) => l.status === 'Repaid' || l.status === 'Closed');
  const completedLoansCount = completedLoans.length;

  // Liquidated Loans
  const liquidatedLoans = lenderLoans.filter((l) => l.status === 'Liquidated');
  const liquidatedLoansCount = liquidatedLoans.length;

  // Stats
  const totalLentVal = activeLoans.reduce((sum, l) => sum + l.amount, 0);
  const totalExpectedInterest = activeLoans.reduce((sum, l) => {
    return sum + calculateInterestAmount(l.amount, l.apr, l.duration);
  }, 0);

  const totalInterestEarned = completedLoans.reduce((sum, l) => {
    return sum + calculateInterestAmount(l.amount, l.apr, l.duration);
  }, 0);

  // Table Data Columns
  const columns = [
    {
      title: 'Contract ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{text}</Text>,
    },
    {
      title: 'Borrower',
      dataIndex: 'borrower',
      key: 'borrower',
      render: (text: string) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{formatAddress(text)}</Text>,
    },
    {
      title: 'Principal',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => <Text strong>{formatCurrency(amount, record.asset)}</Text>,
    },
    {
      title: 'Fixed APR',
      dataIndex: 'apr',
      key: 'apr',
      render: (apr: number) => <Text style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{apr}%</Text>,
    },
    {
      title: 'Current HF',
      dataIndex: 'healthFactor',
      key: 'healthFactor',
      render: (hf: number, record: any) => {
        if (!isOpenLoanStatus(record.status)) return <Text type="secondary">N/A</Text>;
        return (
          <Space size={6}>
            <Text strong>{hf.toFixed(2)}</Text>
            <RiskBadge healthFactor={hf} />
          </Space>
        );
      },
    },
    {
      title: 'Contract Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: any) => <LoanStatusBadge status={status} />,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string, record: any) => {
        if (!isOpenLoanStatus(record.status)) return <Text type="secondary">N/A</Text>;
        return <span>{new Date(date).toLocaleDateString()}</span>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button size="small" onClick={() => navigate(`/app/loans/${record.id}`)}>
            View Details
          </Button>
          {record.status === 'Repaid' && !record.claimedByLender && (
            <Button size="small" type="primary" onClick={() => handleClaimYield(record.id)}>
              Claim Settled Funds
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const offerColumns = [
    {
      title: 'Offer ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => <Text strong style={{ fontFamily: 'var(--font-mono)' }}>{text}</Text>,
    },
    {
      title: 'Principal',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: any) => <Text strong>{formatCurrency(amount, record.asset)}</Text>,
    },
    {
      title: 'APR / Duration',
      key: 'terms',
      render: (_: any, record: any) => <span>{record.apr}% APR / {record.duration} Days</span>,
    },
    {
      title: 'Collateral Terms',
      key: 'collateral',
      render: (_: any, record: any) => (
        <span>{record.collateralAsset} / {record.maxLTV}% Max LTV / {record.liquidationThreshold}% Threshold</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: any) => <OfferStatusBadge status={status} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button size="small" onClick={() => navigate(`/app/loans/${record.id}`)}>
            View Details
          </Button>
          {record.status === 'Draft' && (
            <Button size="small" type="primary" onClick={() => void fundOffer(record.id)}>
              Fund
            </Button>
          )}
          {record.status === 'Funding' && (
            <Button size="small" type="primary" onClick={() => void activateOffer(record.id)}>
              Activate
            </Button>
          )}
          {['Draft', 'Funding', 'Active'].includes(record.status) && (
            <Button size="small" danger onClick={() => void cancelOffer(record.id)}>
              Cancel Offer
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [claimingLoanId, setClaimingLoanId] = useState<string | null>(null);

  const handleClaimYield = (loanId: string) => {
    setClaimingLoanId(loanId);
    setClaimModalVisible(true);
  };

  const confirmClaim = async () => {
    if (!claimingLoanId) {
      throw new Error('No loan selected');
    }
    await claimRepayment(claimingLoanId);
    setClaimModalVisible(false);
    setClaimingLoanId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            Lender Portfolio
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Monitor outstanding principal, expected yields, and claim payments.
          </Paragraph>
        </div>
        <Button type="primary" onClick={() => navigate('/app/create-loan')}>
          Create New Offer
        </Button>
      </div>

      {/* Stats row */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={4}>
          <StatisticCard title="Active Lent Principal" value={formatCurrency(totalLentVal, 'USDC')} icon={<Coins size={22} />} />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatisticCard
            title="Expected Yield Interest"
            value={formatCurrency(totalExpectedInterest, 'USDC')}
            icon={<TrendingUp size={22} />}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <StatisticCard
            title="Accrued Yield Claimed"
            value={formatCurrency(totalInterestEarned, 'USDC')}
            icon={<CheckCircle size={22} />}
          />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatisticCard title="Loans / Active Offers" value={`${activeLoansCount}/${activeOffers.length}`} icon={<FileBadge size={22} />} />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatisticCard title="Funding / Settled" value={`${fundingOffers.length}/${completedLoansCount}`} icon={<CheckCircle size={22} />} />
        </Col>
        <Col xs={12} sm={6} lg={4}>
          <StatisticCard title="Liquidated Loans" value={liquidatedLoansCount} icon={<AlertTriangle size={22} />} />
        </Col>
      </Row>

      {/* Table view of contracts */}
      {lenderLoans.length === 0 && lenderOffers.length === 0 ? (
        <EmptyState
          title="No lending positions yet."
          description="You have not created any loan offers yet. Create your first contract offer to start earning yield."
          action={
            <Button type="primary" onClick={() => navigate('/app/create-loan')}>
              Create Loan Offer
            </Button>
          }
        />
      ) : (
        <>
          {lenderOffers.length > 0 && (
            <Card title="Loan Offers" styles={{ body: { padding: 0 } }}>
              <Table columns={offerColumns} dataSource={lenderOffers.map((item) => ({ ...item, key: item.id }))} pagination={false} />
            </Card>
          )}
          {lenderLoans.length > 0 && (
            <Card title="Lending Contracts Ledger" styles={{ body: { padding: 0 } }}>
              <Table columns={columns} dataSource={lenderLoans.map((item) => ({ ...item, key: item.id }))} pagination={false} />
            </Card>
          )}
        </>
      )}

      {/* Claim Yield Modal */}
      <ConfirmActionModal
        visible={claimModalVisible}
        onCancel={() => setClaimModalVisible(false)}
        onConfirm={confirmClaim}
        title="Claim Settled Loan Escrow"
        actionText="Execute Claim Call"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p>The borrower has completed full repayment of their loan contract.</p>
          <div style={{
            background: 'var(--bg-color)',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '13px'
          }}>
            <div>- <b>Principal to Release:</b> ${loans.find((l) => l.id === claimingLoanId)?.amount.toLocaleString()} USDC</div>
            <div>- <b>Accrued Interest Yield:</b> +${(
              (loans.find((l) => l.id === claimingLoanId)?.amount || 0) *
              ((loans.find((l) => l.id === claimingLoanId)?.apr || 0) / 100) *
              ((loans.find((l) => l.id === claimingLoanId)?.duration || 0) / 365)
            ).toFixed(2)} USDC</div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            * This action calls the Soroban contract to withdraw the deposited USDC + interest from the contract escrow into your wallet.
          </p>
        </div>
      </ConfirmActionModal>
    </div>
  );
};

