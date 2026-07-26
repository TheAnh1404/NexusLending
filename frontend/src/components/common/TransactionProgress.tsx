import React, { useState } from 'react';
import { Modal, Typography, Space, Button, Tag } from 'antd';
import { XCircle, ExternalLink, KeyRound, Lock, ShieldCheck, Sparkles, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

import { EXPLORER_NETWORK } from '../../services/soroban/config';

const { Title, Paragraph, Text } = Typography;

export type TransactionStepState =
  | 'idle'
  | 'preparing'
  | 'signing'
  | 'simulating'
  | 'submitting'
  | 'confirming'
  | 'success'
  | 'failed'
  | 'rejected';

interface TransactionProgressProps {
  open: boolean;
  state: TransactionStepState;
  title?: string;
  successMessage?: string;
  txHash?: string;
  rawError?: string;
  onClose: () => void;
  onViewLoan?: () => void;
}

const getFriendlyErrorMessage = (errorText?: string): string => {
  if (!errorText) return 'Transaction could not be completed.';
  if (errorText.toLowerCase().includes('user rejected') || errorText.toLowerCase().includes('declined')) {
    return 'Transaction request was cancelled in your wallet.';
  }
  if (errorText.toLowerCase().includes('insufficient') || errorText.toLowerCase().includes('balance')) {
    return 'Your wallet balance is insufficient to complete this transaction.';
  }
  if (errorText.toLowerCase().includes('expired') || errorText.toLowerCase().includes('unavailable')) {
    return 'The offer or loan state is no longer available on the blockchain.';
  }
  return 'Transaction could not be completed. The offer may no longer be available, your balance may be insufficient, or the blockchain rejected the request.';
};

export const TransactionProgress: React.FC<TransactionProgressProps> = ({
  open,
  state,
  successMessage = 'Action completed successfully on the Stellar Soroban protocol.',
  txHash,
  rawError,
  onClose,
  onViewLoan,
}) => {
  const [showTechnical, setShowTechnical] = useState(false);

  const isSigningPhase = state === 'preparing' || state === 'signing';
  const isExecutingPhase = state === 'simulating' || state === 'submitting' || state === 'confirming';
  const isExecuting = isSigningPhase || isExecutingPhase;
  const isSuccess = state === 'success';
  const isFailed = state === 'failed' || state === 'rejected';

  return (
    <Modal
      open={open}
      footer={null}
      closable={!isExecuting}
      onCancel={isExecuting ? undefined : onClose}
      centered
      width={460}
      styles={{
        mask: {
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
        },
        wrapper: {
          border: 'none',
        },
        body: {
          borderRadius: '24px',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          border: 'none',
        },
      }}


    >
      <div
        style={{
          position: 'relative',
          padding: '32px 28px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
          color: '#ffffff',
          overflow: 'hidden',
        }}
      >
        {/* Background Glowing Orb Effect */}
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            background: isSuccess
              ? 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, rgba(16, 185, 129, 0) 70%)'
              : isFailed
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0) 70%)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(99, 102, 241, 0) 70%)',
            filter: 'blur(25px)',
            pointerEvents: 'none',
          }}
        />

        {/* ── PHASE 1: WALLET SIGNATURE STEP ──────────────────────────────────── */}
        {isSigningPhase && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20, position: 'relative', zIndex: 2 }}>
            <Tag
              color="purple"
              style={{
                borderRadius: 20,
                fontWeight: 800,
                fontSize: 11,
                padding: '4px 14px',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                color: '#c4b5fd',
                letterSpacing: '0.05em',
                margin: 0,
              }}
            >
              STEP 1 OF 2 • SIGNING CONTRACT DRAFT
            </Tag>

            {/* Glowing Key Signature Animation */}
            <div style={{ position: 'relative', margin: '10px 0' }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  border: '2px solid rgba(129, 140, 248, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)',
                }}
              >
                <KeyRound size={38} style={{ color: '#818cf8' }} />
              </div>
            </div>

            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#ffffff' }}>
                Confirming in Wallet...
              </Title>
              <Paragraph style={{ margin: '8px 0 0 0', fontSize: 13, color: '#cbd5e1', lineHeight: '1.5' }}>
                Please review and approve the contract authorization prompt in your Freighter or Albedo wallet extension.
              </Paragraph>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '8px 16px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                fontSize: 12,
                color: '#94a3b8',
              }}
            >
              <RefreshCw size={14} className="pulse-animation" style={{ color: '#818cf8' }} />
              <span>Awaiting cryptographic signature...</span>
            </div>
          </div>
        )}

        {/* ── PHASE 2: ON-CHAIN EXECUTION STEP ────────────────────────────────── */}
        {isExecutingPhase && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20, position: 'relative', zIndex: 2 }}>
            <Tag
              color="cyan"
              style={{
                borderRadius: 20,
                fontWeight: 800,
                fontSize: 11,
                padding: '4px 14px',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                color: '#67e8f9',
                letterSpacing: '0.05em',
                margin: 0,
              }}
            >
              STEP 2 OF 2 • EXECUTING SOROBAN ESCROW
            </Tag>

            {/* Glowing Escrow Lock Animation */}
            <div style={{ position: 'relative', margin: '10px 0' }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(6, 182, 212, 0.15)',
                  border: '2px solid rgba(6, 182, 212, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(6, 182, 212, 0.4)',
                }}
              >
                <Lock size={38} style={{ color: '#22d3ee' }} />
              </div>
            </div>

            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#ffffff' }}>
                Executing Smart Escrow...
              </Title>
              <Paragraph style={{ margin: '8px 0 0 0', fontSize: 13, color: '#cbd5e1', lineHeight: '1.5' }}>
                Submitting signed contract payload to Stellar Soroban Testnet RPC nodes for final confirmation.
              </Paragraph>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(6, 182, 212, 0.12)',
                borderRadius: 12,
                padding: '8px 16px',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                fontSize: 12,
                color: '#67e8f9',
              }}
            >
              <Sparkles size={14} />
              <span>Verifying ledger transaction...</span>
            </div>
          </div>
        )}

        {/* ── PHASE 3: SUCCESS ────────────────────────────────────────────────── */}
        {isSuccess && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20, position: 'relative', zIndex: 2 }}>
            <Tag
              color="green"
              style={{
                borderRadius: 20,
                fontWeight: 800,
                fontSize: 11,
                padding: '4px 14px',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#6ee7b7',
                letterSpacing: '0.05em',
                margin: 0,
              }}
            >
              PROTOCOL TRANSACTION VERIFIED
            </Tag>

            {/* Victory Badge */}
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid rgba(16, 185, 129, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 35px rgba(16, 185, 129, 0.4)',
              }}
            >
              <ShieldCheck size={44} style={{ color: '#34d399' }} />
            </div>

            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#ffffff' }}>
                Contract Signed & Executed!
              </Title>
              <Paragraph style={{ margin: '8px 0 0 0', fontSize: 13, color: '#cbd5e1', lineHeight: '1.5' }}>
                {successMessage}
              </Paragraph>
            </div>

            {txHash && (
              <div
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                }}
              >
                <Text style={{ color: '#94a3b8' }}>Stellar Tx Hash:</Text>
                <a
                  href={`https://stellar.expert/explorer/${EXPLORER_NETWORK}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#818cf8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                  }}
                >
                  {txHash.slice(0, 8)}...{txHash.slice(-8)}
                  <ExternalLink size={13} />
                </a>
              </div>
            )}


            <Space size={12} style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
              {onViewLoan && (
                <Button
                  type="primary"
                  onClick={onViewLoan}
                  style={{
                    borderRadius: 10,
                    fontWeight: 700,
                    height: 42,
                    padding: '0 20px',
                    backgroundColor: '#4f46e5',
                  }}
                >
                  View Details
                </Button>
              )}
              <Button
                onClick={onClose}
                style={{
                  borderRadius: 10,
                  fontWeight: 600,
                  height: 42,
                  padding: '0 24px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                Close
              </Button>
            </Space>
          </div>
        )}

        {/* ── PHASE 4: FAILED / REJECTED ──────────────────────────────────────── */}
        {isFailed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20, position: 'relative', zIndex: 2 }}>
            <Tag
              color="error"
              style={{
                borderRadius: 20,
                fontWeight: 800,
                fontSize: 11,
                padding: '4px 14px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                letterSpacing: '0.05em',
                margin: 0,
              }}
            >
              TRANSACTION INTERRUPTED
            </Tag>

            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '2px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)',
              }}
            >
              <XCircle size={44} style={{ color: '#f87171' }} />
            </div>

            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#ffffff' }}>
                Signing Interrupted
              </Title>
              <Paragraph style={{ margin: '8px 0 0 0', fontSize: 13, color: '#fca5a5', lineHeight: '1.5' }}>
                {getFriendlyErrorMessage(rawError)}
              </Paragraph>
            </div>

            {rawError && (
              <div style={{ width: '100%', textAlign: 'left' }}>
                <Button
                  type="text"
                  size="small"
                  onClick={() => setShowTechnical(!showTechnical)}
                  style={{
                    color: '#94a3b8',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 0,
                  }}
                >
                  <span>{showTechnical ? 'Hide Technical Details' : 'Show Technical Traceback'}</span>
                  {showTechnical ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
                {showTechnical && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      backgroundColor: 'rgba(0, 0, 0, 0.4)',
                      borderRadius: 10,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: '#f87171',
                      maxHeight: 120,
                      overflowY: 'auto',
                      wordBreak: 'break-all',
                    }}
                  >
                    {rawError}
                  </div>
                )}
              </div>
            )}

            <Button
              type="primary"
              onClick={onClose}
              style={{
                borderRadius: 10,
                fontWeight: 700,
                height: 42,
                padding: '0 28px',
                backgroundColor: '#ef4444',
                borderColor: '#ef4444',
              }}
            >
              Close & Retry
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};
