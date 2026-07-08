import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, InputNumber, Modal, Segmented, Space, Typography } from 'antd';
import { ArrowDown, Coins, RefreshCw } from 'lucide-react';
import { useLending } from '../../contexts/LendingContext';
import { DATA_MODE } from '../../services/api/client';
import { quoteStellarSwap, type SwapDirection } from '../../services/soroban/transaction';

const { Text, Title } = Typography;

const SLIPPAGE_TOLERANCE = 0.02;
const STELLAR_PRECISION = 7;

const roundUpStellarAmount = (amount: number): number => {
  const factor = 10 ** STELLAR_PRECISION;
  return Math.ceil((amount * factor) - 1e-9) / factor;
};

const formatAmount = (amount: number, maximumFractionDigits = STELLAR_PRECISION): string =>
  amount.toLocaleString(undefined, {
    maximumFractionDigits,
  });

interface SwapModalProps {
  open: boolean;
  onCancel: () => void;
}

export const SwapModal: React.FC<SwapModalProps> = ({ open, onCancel }) => {
  const { wallet, oraclePrices, swapTokens } = useLending();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<SwapDirection>('XLM_TO_USDC');
  const [receiveAmount, setReceiveAmount] = useState<number>(100);
  const [quoteSendAmount, setQuoteSendAmount] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const xlmPrice = oraclePrices.find((p) => p.asset === 'XLM')?.price || 0.125;
  const shouldUseDexQuote = DATA_MODE === 'api';
  const sendAsset = direction === 'XLM_TO_USDC' ? 'XLM' : 'USDC';
  const receiveAsset = direction === 'XLM_TO_USDC' ? 'USDC' : 'XLM';
  const sendBalance = direction === 'XLM_TO_USDC' ? wallet.balanceXLM : wallet.balanceUSDC;
  const receiveBalance = direction === 'XLM_TO_USDC' ? wallet.balanceUSDC : wallet.balanceXLM;

  const estimatedSend = useMemo(() => {
    if (receiveAmount <= 0) return 0;
    return direction === 'XLM_TO_USDC'
      ? receiveAmount / xlmPrice
      : receiveAmount * xlmPrice;
  }, [direction, receiveAmount, xlmPrice]);

  useEffect(() => {
    if (!shouldUseDexQuote || !open || receiveAmount <= 0) {
      setQuoteSendAmount(null);
      setQuoteError(null);
      setQuoteLoading(false);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setQuoteError(null);

    const timeoutId = window.setTimeout(() => {
      void quoteStellarSwap(direction, receiveAmount)
        .then((quote) => {
          if (cancelled) return;
          const nextSendAmount = Number(quote.requiredSendAmount);
          setQuoteSendAmount(Number.isFinite(nextSendAmount) ? nextSendAmount : null);
        })
        .catch((error) => {
          if (cancelled) return;
          setQuoteSendAmount(null);
          setQuoteError(error instanceof Error ? error.message : 'Unable to quote this swap route.');
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [direction, open, receiveAmount, shouldUseDexQuote]);

  const maxSend = useMemo(() => {
    const baseSendAmount = quoteSendAmount ?? estimatedSend;
    if (baseSendAmount <= 0) return 0;
    return roundUpStellarAmount(baseSendAmount * (1 + SLIPPAGE_TOLERANCE));
  }, [estimatedSend, quoteSendAmount]);

  const hasEnoughBalance = sendBalance >= maxSend;
  const quotePending = shouldUseDexQuote && (quoteLoading || quoteSendAmount === null);
  const rateText = direction === 'XLM_TO_USDC'
    ? `1 XLM ~ ${xlmPrice.toFixed(4)} USDC`
    : `1 USDC ~ ${(1 / xlmPrice).toFixed(4)} XLM`;

  const handleSwap = async () => {
    try {
      await form.validateFields();
      setLoading(true);
      const success = await swapTokens(direction, receiveAmount, maxSend);
      if (success) {
        onCancel();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Coins size={20} style={{ color: 'var(--primary-color)' }} />
          <Title level={4} style={{ margin: 0, fontSize: '18px' }}>Swap XLM / USDC</Title>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      width={420}
      style={{ borderRadius: '8px', overflow: 'hidden' }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ receiveAmount: 100 }}
        onValuesChange={(_, all) => {
          const nextAmount = Number(all.receiveAmount ?? 0);
          setReceiveAmount(Number.isFinite(nextAmount) ? nextAmount : 0);
        }}
        style={{ marginTop: '16px' }}
      >
        <Segmented
          block
          value={direction}
          onChange={(value) => setDirection(value as SwapDirection)}
          options={[
            { label: 'XLM -> USDC', value: 'XLM_TO_USDC' },
            { label: 'USDC -> XLM', value: 'USDC_TO_XLM' },
          ]}
          style={{ marginBottom: '16px' }}
        />

        <div style={{
          backgroundColor: 'var(--border-light)',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '12px' }}>
            <Text type="secondary">Send Asset</Text>
            <Text type="secondary">Balance: {formatAmount(sendBalance, 4)} {sendAsset}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <Title level={4} style={{ margin: 0 }}>{sendAsset}</Title>
            <Text strong style={{ fontSize: '16px' }}>{formatAmount(quoteSendAmount ?? estimatedSend)} {sendAsset}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
            {quoteSendAmount !== null ? 'Best Horizon path' : 'Oracle estimate'} with 2% slippage: {formatAmount(maxSend)} {sendAsset}
          </Text>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
          <div style={{
            backgroundColor: 'var(--primary-color)',
            color: '#FFFFFF',
            borderRadius: '50%',
            padding: '8px',
            display: 'inline-flex',
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.2)'
          }}>
            <ArrowDown size={16} />
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--border-light)',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '12px' }}>
            <Text type="secondary">Receive Asset</Text>
            <Text type="secondary">Balance: {formatAmount(receiveBalance, 4)} {receiveAsset}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <Title level={4} style={{ margin: 0 }}>{receiveAsset}</Title>
            <Form.Item
              name="receiveAmount"
              style={{ margin: 0, width: '160px' }}
              rules={[{ required: true, message: 'Enter receive amount' }]}
            >
              <InputNumber
                min={0.0000001}
                max={100000}
                precision={STELLAR_PRECISION}
                style={{ width: '100%' }}
                size="large"
                placeholder="100"
              />
            </Form.Item>
          </div>
        </div>

        <div style={{ marginBottom: '16px', fontSize: '12px' }}>
          <Space style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Text type="secondary">Exchange Rate:</Text>
            <Text strong>{rateText}</Text>
          </Space>
        </div>

        {direction === 'XLM_TO_USDC' && (
          <Alert
            message="USDC trustline"
            description="If your wallet does not have a USDC trustline, this swap transaction will add it before exchanging."
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {shouldUseDexQuote && quoteError && (
          <Alert
            message="Swap route unavailable"
            description={quoteError}
            type="error"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {!hasEnoughBalance && (
          <Alert
            message={`Insufficient ${sendAsset} Balance`}
            description={`You need up to ${formatAmount(maxSend)} ${sendAsset}, but your balance is ${formatAmount(sendBalance)} ${sendAsset}.`}
            type="error"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        <Button
          type="primary"
          size="large"
          loading={loading}
          disabled={!hasEnoughBalance || quotePending || !!quoteError || receiveAmount <= 0 || maxSend <= 0}
          onClick={handleSwap}
          style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '6px' }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Confirm Swap
        </Button>
      </Form>
    </Modal>
  );
};
