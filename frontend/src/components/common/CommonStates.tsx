import React from 'react';
import { Empty, Spin, Result } from 'antd';
import { AlertCircle, Loader2 } from 'lucide-react';

interface StateProps {
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<StateProps & { action?: React.ReactNode }> = ({
  title = 'No Data Found',
  description = 'There are no active records matching this section.',
  action,
}) => {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <h4 style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>{title}</h4>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{description}</span>
          </div>
        }
      >
        {action}
      </Empty>
    </div>
  );
};

export const LoadingState: React.FC<StateProps> = ({
  title = 'Loading...',
  description = 'Retrieving data from the Stellar Network...',
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 0',
      gap: '16px'
    }}>
      <Spin indicator={<Loader2 size={36} className="pulse-animation" style={{ color: 'var(--primary-color)' }} />} />
      <div style={{ textAlign: 'center' }}>
        <h4 style={{ fontWeight: 600, color: 'var(--text-main)' }}>{title}</h4>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{description}</span>
      </div>
    </div>
  );
};

export const ErrorState: React.FC<StateProps & { onRetry?: () => void }> = ({
  title = 'Connection Timeout',
  description = 'Failed to load details from the Stellar Soroban RPC node.',
  onRetry,
}) => {
  return (
    <Result
      status="warning"
      icon={<AlertCircle size={48} style={{ color: 'var(--danger-color)' }} />}
      title={title}
      subTitle={description}
      extra={
        onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Retry Connection
          </button>
        )
      }
    />
  );
};
