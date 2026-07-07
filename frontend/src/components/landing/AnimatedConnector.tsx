import React from 'react';

interface AnimatedConnectorProps {
  d: string;
  color?: string;
  width?: number;
  reverse?: boolean;
}

export const AnimatedConnector: React.FC<AnimatedConnectorProps> = ({
  d,
  color = '#2F80ED',
  width = 2,
  reverse = false,
}) => {
  return (
    <svg style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 1,
    }}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray="6, 4"
        style={{
          strokeLinecap: 'round',
          animation: `${reverse ? 'flow-left' : 'flow-right'} 1.8s infinite linear`,
        }}
      />
    </svg>
  );
};
