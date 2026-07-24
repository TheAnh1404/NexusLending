import React, { useState } from 'react';
import { Typography, Space, Button, message } from 'antd';
import { ChevronDown, ChevronUp, Copy, Check, ExternalLink, Code } from 'lucide-react';

const { Text } = Typography;

export interface AdvancedDetailItem {
  label: string;
  value: string | number | React.ReactNode;
  copyable?: boolean;
  rawTextToCopy?: string;
  explorerUrl?: string;
  tooltip?: string;
}

interface AdvancedDetailsProps {
  title?: string;
  items: AdvancedDetailItem[];
  defaultOpen?: boolean;
}

export const AdvancedDetails: React.FC<AdvancedDetailsProps> = ({
  title = 'Advanced Details',
  items,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
    message.success('Copied to clipboard');
  };

  return (
    <div
      style={{
        border: '1px solid var(--border-light, #e5e7eb)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-subtle, #f9fafb)',
        overflow: 'hidden',
        marginTop: '16px',
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-muted, #6b7280)',
          fontWeight: 500,
          fontSize: '13px',
        }}
      >
        <Space size={6}>
          <Code size={14} />
          <span>{title}</span>
        </Space>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-light, #e5e7eb)',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
              }}
            >
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {item.label}
              </Text>
              <Space size={6} style={{ alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: '12px',
                    fontFamily: typeof item.value === 'string' && (item.value.startsWith('0x') || item.value.length > 20) ? 'var(--font-mono, monospace)' : 'inherit',
                  }}
                >
                  {item.value}
                </Text>

                {item.copyable && (item.rawTextToCopy || typeof item.value === 'string') && (
                  <Button
                    type="text"
                    size="small"
                    style={{ padding: '0 4px', height: '20px', minWidth: '20px' }}
                    icon={
                      copiedIndex === idx ? (
                        <Check size={12} style={{ color: 'var(--success-color, #10b981)' }} />
                      ) : (
                        <Copy size={12} />
                      )
                    }
                    onClick={() => handleCopy(item.rawTextToCopy || String(item.value), idx)}
                  />
                )}

                {item.explorerUrl && (
                  <a
                    href={item.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--primary-color, #4f46e5)', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </Space>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
