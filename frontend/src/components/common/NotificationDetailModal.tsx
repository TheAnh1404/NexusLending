import React from 'react';
import { Modal, Typography, Tag, Button, Divider } from 'antd';
import {
  Bell,
  CheckCircle2,
  Copy,
  Check,
  Calendar,
  Wallet,
  FileText,
  Trash2,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import type { Transaction } from '../../types';
import { formatAddress, formatCurrency } from '../../utils/finance';

const { Title, Text } = Typography;

interface NotificationDetailModalProps {
  open: boolean;
  activity: Transaction | null;
  onClose: () => void;
  onDismiss?: (id: string) => void;
  onViewLoan?: (loanId: string) => void;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  open,
  activity,
  onClose,
  onDismiss,
  onViewLoan,
}) => {
  const [copiedTx, setCopiedTx] = React.useState(false);
  const [copiedUser, setCopiedUser] = React.useState(false);

  if (!activity) return null;

  const handleCopy = (text: string, type: 'tx' | 'user') => {
    navigator.clipboard.writeText(text);
    if (type === 'tx') {
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 1500);
    } else {
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 1500);
    }
  };

  const formattedType = activity.type.replace(/_/g, ' ');
  const formattedTime = new Date(activity.timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={520}
      styles={{
        mask: {
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
        },
        body: {
          borderRadius: '16px',
          padding: '24px',
        },
      }}
    >
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary-color, #4f46e5)',
            }}
          >
            <Bell size={24} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
              {formattedType}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Notification Details & On-Chain Audit
            </Text>
          </div>
        </div>
        <Tag color="green" style={{ borderRadius: 6, padding: '4px 8px', fontWeight: 700, fontSize: 12 }}>
          <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
          SUCCESS
        </Tag>
      </div>

      {/* Main Amount & Time Summary Box */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9) 0%, rgba(241, 245, 249, 0.9) 100%)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 14,
          padding: 18,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
            Transaction Amount
          </Text>
          <Text strong style={{ fontSize: 20, color: 'var(--primary-color, #4f46e5)', fontWeight: 800 }}>
            {activity.amount > 0 ? formatCurrency(activity.amount, activity.asset) : activity.asset || 'N/A'}
          </Text>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> Timestamp:
            </Text>
            <Text strong>{formattedTime}</Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wallet size={14} /> User Wallet:
            </Text>
            <Text
              code
              copyable={false}
              onClick={() => handleCopy(activity.user, 'user')}
              style={{ cursor: 'pointer', fontSize: 12, borderRadius: 6, margin: 0 }}
            >
              {formatAddress(activity.user)}
              {copiedUser ? <Check size={12} style={{ color: '#10b981', marginLeft: 4 }} /> : <Copy size={12} style={{ marginLeft: 4 }} />}
            </Text>
          </div>
        </div>
      </div>

      {/* Description Box */}
      <div style={{ marginBottom: 20 }}>
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
          ACTIVITY LOG DETAILS
        </Text>
        <div
          style={{
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13,
            color: 'var(--text-main, #1e293b)',
            lineHeight: 1.5,
          }}
        >
          {activity.details || 'No additional description log available for this transaction.'}
        </div>
      </div>

      {/* Associated Identifiers (Loan / Offer) */}
      {(activity.loanId || activity.offerId) && (
        <div style={{ marginBottom: 20 }}>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            ASSOCIATED PROTOCOL ENTITIES
          </Text>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {activity.loanId && (
              <Button
                type="default"
                size="small"
                icon={<FileText size={14} />}
                onClick={() => {
                  if (onViewLoan && activity.loanId) onViewLoan(activity.loanId);
                  onClose();
                }}
                style={{ borderRadius: 8, fontWeight: 600 }}
              >
                View Loan #{activity.loanId}
              </Button>
            )}
            {activity.offerId && (
              <Tag color="purple" style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                Offer ID: {activity.offerId}
              </Tag>
            )}
          </div>
        </div>
      )}

      {/* On-Chain Verification Section */}
      <div
        style={{
          border: '1px solid rgba(79, 70, 229, 0.2)',
          backgroundColor: 'rgba(79, 70, 229, 0.03)',
          borderRadius: 12,
          padding: 14,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 13, color: 'var(--primary-color, #4f46e5)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} /> Stellar Testnet Verification
          </Text>
          {activity.ledger && (
            <Tag color="blue" style={{ borderRadius: 4, fontSize: 11, margin: 0 }}>
              Ledger #{activity.ledger}
            </Tag>
          )}
        </div>

        {activity.txHash ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Transaction Hash:</Text>
              <Text
                code
                onClick={() => handleCopy(activity.txHash!, 'tx')}
                style={{ cursor: 'pointer', fontSize: 11, borderRadius: 6, margin: 0 }}
              >
                {activity.txHash.slice(0, 10)}...{activity.txHash.slice(-10)}
                {copiedTx ? <Check size={12} style={{ color: '#10b981', marginLeft: 4 }} /> : <Copy size={12} style={{ marginLeft: 4 }} />}
              </Text>
            </div>

            {activity.explorerUrl && (
              <Button
                type="link"
                href={activity.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                icon={<ArrowUpRight size={14} />}
                style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600, textAlign: 'left' }}
              >
                View Transaction on StellarExpert Explorer
              </Button>
            )}
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Transaction logged on local ledger state. Connect to live Testnet API mode for explorer verification.
          </Text>
        )}
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {onDismiss ? (
          <Button
            type="text"
            danger
            icon={<Trash2 size={16} />}
            onClick={() => {
              onDismiss(activity.id);
              onClose();
            }}
            style={{ fontWeight: 600 }}
          >
            Clear Notification
          </Button>
        ) : <div />}

        <Button type="primary" size="large" onClick={onClose} style={{ borderRadius: 10, padding: '0 24px', fontWeight: 700 }}>
          Close
        </Button>
      </div>
    </Modal>
  );
};
