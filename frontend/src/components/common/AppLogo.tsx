import React from 'react';
import { Layers } from 'lucide-react';

interface AppLogoProps {
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

export const AppLogo: React.FC<AppLogoProps> = ({ size = 'medium', onClick }) => {
  const iconBoxSize = size === 'small' ? 32 : size === 'medium' ? 36 : 42;
  const iconSize = size === 'small' ? 16 : size === 'medium' ? 18 : 22;
  const fontSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${iconBoxSize}px`,
          height: `${iconBoxSize}px`,
          backgroundColor: 'var(--primary-color, #4F46E5)',
          borderRadius: '8px',
          color: '#ffffff',
          boxShadow: '0 4px 10px rgba(79, 70, 229, 0.25)',
        }}
      >
        <Layers size={iconSize} />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-heading, "Outfit", sans-serif)',
          fontSize: `${fontSize}px`,
          fontWeight: 700,
          color: 'var(--text-main, #0F172A)',
          letterSpacing: '-0.02em',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        NEXUS
      </span>
    </div>
  );
};
