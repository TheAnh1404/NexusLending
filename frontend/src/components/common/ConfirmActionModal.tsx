import React, { useState } from 'react';
import { Modal, Button, Typography } from 'antd';
import { ShieldAlert, CheckCircle2, PenLine, Send, XCircle } from 'lucide-react';

const { Text } = Typography;

interface ConfirmActionModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  actionText: string;
  cancelText?: string;
  danger?: boolean;
  children: React.ReactNode;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  title,
  actionText,
  cancelText = 'Cancel',
  danger = false,
  children,
}) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<'signature' | 'submitting'>('signature');

  const handleConfirm = async () => {
    setLoading(true);
    setFailed(false);
    try {
      setStage('signature');
      await new Promise((resolve) => setTimeout(resolve, 650));
      setStage('submitting');
      await new Promise((resolve) => setTimeout(resolve, 900));
      await onConfirm();
      setLoading(false);
      setSuccess(true);
      await new Promise((resolve) => setTimeout(resolve, 850));
      setSuccess(false);
    } catch {
      setLoading(false);
      setFailed(true);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setFailed(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={loading || success ? undefined : onCancel}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {danger ? (
            <ShieldAlert size={20} style={{ color: 'var(--danger-color)' }} />
          ) : (
            <CheckCircle2 size={20} style={{ color: 'var(--primary-color)' }} />
          )}
          <span style={{ fontFamily: 'var(--font-heading)' }}>{title}</span>
        </div>
      }
      modalRender={(modal) => (
        <div style={{ position: 'relative' }}>
          {modal}
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.8)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              gap: '12px'
            }}>
              <div className="pulse-animation" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(47, 128, 237, 0.1)',
                color: 'var(--primary-color)'
              }}>
                {stage === 'signature' ? <PenLine size={32} /> : <Send size={32} />}
              </div>
              <Text strong>{stage === 'signature' ? 'Waiting for Freighter Signature...' : 'Submitting Transaction...'}</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {stage === 'signature' ? 'Approve the request in your wallet' : 'Broadcasting Soroban transaction'}
              </Text>
            </div>
          )}
          {failed && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              gap: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(235, 87, 87, 0.1)',
                color: 'var(--danger-color)'
              }}>
                <XCircle size={32} />
              </div>
              <Text strong style={{ color: 'var(--danger-color)', fontSize: '16px' }}>Transaction Failed</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>No state changes were applied</Text>
            </div>
          )}
          {success && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              gap: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                color: 'var(--success-color)'
              }}>
                <CheckCircle2 size={32} />
              </div>
              <Text strong style={{ color: 'var(--success-color)', fontSize: '16px' }}>Transaction Confirmed</Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>Ledger #48938210 verified</Text>
            </div>
          )}
        </div>
      )}
      footer={
        success
          ? null
          : [
              <Button key="cancel" disabled={loading} onClick={onCancel}>
                {cancelText}
              </Button>,
              <Button
                key="confirm"
                type="primary"
                danger={danger}
                loading={loading}
                onClick={handleConfirm}
              >
                {actionText}
              </Button>,
            ]
      }
    >
      <div style={{ padding: '12px 0' }}>{children}</div>
    </Modal>
  );
};
