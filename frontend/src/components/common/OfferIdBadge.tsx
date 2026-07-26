import React, { useState } from 'react';
import { Tooltip } from 'antd';
import { Hash, Copy, Check } from 'lucide-react';

interface OfferIdBadgeProps {
  id: string;
  size?: 'small' | 'medium' | 'large';
  showHash?: boolean;
}

export const OfferIdBadge: React.FC<OfferIdBadgeProps> = ({ id, size = 'medium', showHash = true }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSmall = size === 'small';
  const isLarge = size === 'large';

  return (
    <Tooltip title={copied ? 'Copied to clipboard!' : 'Click to copy Offer ID'}>
      <div
        onClick={handleCopy}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isSmall ? 4 : 6,
          padding: isSmall ? '2px 8px' : isLarge ? '6px 14px' : '4px 10px',
          borderRadius: isSmall ? 6 : 8,
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(37, 99, 235, 0.06) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          color: '#4338ca',
          fontFamily: "'Fira Code', 'Roboto Mono', ui-monospace, SFMono-Regular, monospace",
          fontWeight: 700,
          fontSize: isSmall ? 11 : isLarge ? 14 : 12,
          letterSpacing: '0.02em',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 6px rgba(99, 102, 241, 0.08)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 10px rgba(99, 102, 241, 0.18)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.25)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 6px rgba(99, 102, 241, 0.08)';
        }}
      >
        {showHash && <Hash size={isSmall ? 11 : isLarge ? 14 : 12} style={{ opacity: 0.7, color: '#6366f1' }} />}
        <span>{id}</span>
        {copied ? (
          <Check size={isSmall ? 11 : isLarge ? 14 : 12} style={{ color: '#10b981', marginLeft: 2 }} />
        ) : (
          <Copy size={isSmall ? 11 : isLarge ? 14 : 12} style={{ opacity: 0.5, marginLeft: 2 }} />
        )}
      </div>
    </Tooltip>
  );
};
