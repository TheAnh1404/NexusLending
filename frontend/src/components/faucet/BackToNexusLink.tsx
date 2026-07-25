import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeft } from 'lucide-react';

interface BackToNexusLinkProps {
  customText?: string;
  style?: React.CSSProperties;
}

export const BackToNexusLink: React.FC<BackToNexusLinkProps> = ({ customText = 'Back to Nexus', style }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleBack = () => {
    const rawReturnTo = searchParams.get('returnTo');
    // Safety check against open redirects: returnTo must start with /app or / and not contain // or http
    if (
      rawReturnTo &&
      typeof rawReturnTo === 'string' &&
      rawReturnTo.startsWith('/') &&
      !rawReturnTo.startsWith('//') &&
      !rawReturnTo.toLowerCase().includes('http')
    ) {
      navigate(rawReturnTo);
    } else {
      navigate('/app/marketplace');
    }
  };

  return (
    <Button
      type="default"
      icon={<ArrowLeft size={15} />}
      onClick={handleBack}
      style={{
        borderRadius: 8,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...style,
      }}
    >
      {customText}
    </Button>
  );
};
