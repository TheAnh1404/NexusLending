import React from 'react';
import { Modal, Typography, Row, Col, Timeline, Button } from 'antd';
import { ShieldCheck, Lock, RefreshCw, Zap, CheckCircle2 } from 'lucide-react';

const { Title, Paragraph, Text } = Typography;

interface EscrowLogicModalProps {
  open: boolean;
  onClose: () => void;
  onExploreMarketplace?: () => void;
}

export const EscrowLogicModal: React.FC<EscrowLogicModalProps> = ({ open, onClose, onExploreMarketplace }) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      centered
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              color: 'var(--primary-color, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 800 }}>
              Soroban Smart Escrow Architecture
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Non-custodial peer-to-peer lending logic on Stellar Soroban
            </Text>
          </div>
        </div>
      }
      styles={{
        mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15, 23, 42, 0.65)' },
        body: { padding: '24px 0 12px 0' },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Core Principles Grid */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--border-light, #e2e8f0)',
                height: '100%',
              }}
            >
              <Lock size={20} style={{ color: 'var(--primary-color)', marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>100% Non-Custodial</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Funds and collateral are locked exclusively in audited Soroban smart contracts.
              </div>
            </div>
          </Col>

          <Col xs={24} sm={8}>
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--border-light, #e2e8f0)',
                height: '100%',
              }}
            >
              <Zap size={20} style={{ color: '#06b6d4', marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>~3s Finality</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Instant loan execution and collateral release powered by Stellar ledger speed.
              </div>
            </div>
          </Col>

          <Col xs={24} sm={8}>
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--border-light, #e2e8f0)',
                height: '100%',
              }}
            >
              <RefreshCw size={20} style={{ color: 'var(--success-color)', marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Oracle Pricing</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Real-time price feeds enforce strict Max LTV (75%) and Health Factor calculations.
              </div>
            </div>
          </Col>
        </Row>

        {/* Workflow Timeline */}
        <div style={{ padding: '0 8px' }}>
          <Title level={5} style={{ marginBottom: 16, fontWeight: 700 }}>
            Escrow Lifecycle & Workflow
          </Title>

          <Timeline
            items={[
              {
                color: 'blue',
                children: (
                  <div>
                    <Text strong style={{ fontSize: 14 }}>1. Offer Creation & Liquidity Lock</Text>
                    <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                      Lender publishes a lending offer and deposits USDC liquidity into the Soroban Smart Escrow contract with fixed APR and duration.
                    </Paragraph>
                  </div>
                ),
              },
              {
                color: 'indigo',
                children: (
                  <div>
                    <Text strong style={{ fontSize: 14 }}>2. Collateral Deposit & Instant Payout</Text>
                    <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                      Borrower accepts the offer by locking XLM collateral (Min 133% ratio / Max 75% LTV). Escrow verifies Oracle feed and transfers USDC to borrower instantly.
                    </Paragraph>
                  </div>
                ),
              },
              {
                color: 'green',
                children: (
                  <div>
                    <Text strong style={{ fontSize: 14 }}>3. Repayment & Collateral Release</Text>
                    <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                      Borrower repays principal + fixed interest before due date. Escrow unlocks 100% XLM collateral back to borrower and routes USDC return to lender.
                    </Paragraph>
                  </div>
                ),
              },
              {
                color: 'red',
                children: (
                  <div>
                    <Text strong style={{ fontSize: 14 }}>4. Automated Liquidation Protection</Text>
                    <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                      If XLM price drops and Health Factor falls below 1.0, liquidators can partially liquidate collateral to keep the protocol 100% solvent.
                    </Paragraph>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Risk & Safety Parameters Table */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border-light, #e2e8f0)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success-color)' }} />
            <span>Standard Protocol Safety Parameters</span>
          </div>

          <Row gutter={[16, 8]} style={{ fontSize: 12 }}>
            <Col span={12}>
              <Text type="secondary">Maximum Loan-to-Value (LTV):</Text> <Text strong>75%</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">Liquidation Threshold:</Text> <Text strong>80%</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">Liquidation Bonus:</Text> <Text strong>5%</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary">Minimum Health Factor:</Text> <Text strong>1.4 (Safe)</Text>
            </Col>
          </Row>
        </div>

        {/* CTA Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={onClose} style={{ borderRadius: 8 }}>
            Close
          </Button>
          {onExploreMarketplace && (
            <Button
              type="primary"
              onClick={() => {
                onClose();
                onExploreMarketplace();
              }}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Explore Offers
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
