import React from 'react';
import { motion } from 'framer-motion';

export const SmartContractCube: React.FC = () => {
  return (
    <div style={{
      width: '180px',
      height: '180px',
      perspective: '1000px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 5,
    }}>
      {/* Outer soft glowing aura */}
      <motion.div
        animate={{
          scale: [0.95, 1.05, 0.95],
          opacity: [0.6, 0.85, 0.6],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{
          position: 'absolute',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(47, 128, 237, 0.12) 0%, rgba(79, 70, 229, 0.05) 50%, rgba(255,255,255,0) 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      {/* Layered Glassmorphic Cube representation */}
      <motion.div
        animate={{
          rotateY: 360,
          rotateX: [15, 35, 15],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear"
        }}
        style={{
          width: '100px',
          height: '100px',
          transformStyle: 'preserve-3d',
          position: 'relative',
        }}
      >
        {/* Face 1: Front */}
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          background: 'rgba(255, 255, 255, 0.35)',
          border: '1.5px solid rgba(47, 128, 237, 0.4)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          transform: 'rotateY(0deg) translateZ(50px)',
          boxShadow: 'inset 0 0 15px rgba(47, 128, 237, 0.1)',
        }} />
        {/* Face 2: Back */}
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          background: 'rgba(255, 255, 255, 0.15)',
          border: '1.5px solid rgba(47, 128, 237, 0.25)',
          backdropFilter: 'blur(4px)',
          borderRadius: '12px',
          transform: 'rotateY(180deg) translateZ(50px)',
        }} />
        {/* Face 3: Right */}
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          background: 'rgba(255, 255, 255, 0.25)',
          border: '1.5px solid rgba(79, 70, 229, 0.35)',
          backdropFilter: 'blur(6px)',
          borderRadius: '12px',
          transform: 'rotateY(90deg) translateZ(50px)',
          boxShadow: 'inset 0 0 15px rgba(79, 70, 229, 0.1)',
        }} />
        {/* Face 4: Left */}
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          background: 'rgba(255, 255, 255, 0.25)',
          border: '1.5px solid rgba(79, 70, 229, 0.35)',
          backdropFilter: 'blur(6px)',
          borderRadius: '12px',
          transform: 'rotateY(-90deg) translateZ(50px)',
          boxShadow: 'inset 0 0 15px rgba(79, 70, 229, 0.1)',
        }} />
        {/* Face 5: Top */}
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          background: 'rgba(255, 255, 255, 0.35)',
          border: '1.5px solid rgba(47, 128, 237, 0.4)',
          backdropFilter: 'blur(8px)',
          borderRadius: '12px',
          transform: 'rotateX(90deg) translateZ(50px)',
          boxShadow: 'inset 0 0 15px rgba(47, 128, 237, 0.1)',
        }} />
        {/* Face 6: Bottom */}
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          background: 'rgba(255, 255, 255, 0.15)',
          border: '1.5px solid rgba(47, 128, 237, 0.25)',
          backdropFilter: 'blur(4px)',
          borderRadius: '12px',
          transform: 'rotateX(-90deg) translateZ(50px)',
        }} />

        {/* Inner Glowing Core */}
        <div style={{
          position: 'absolute',
          left: '25px',
          top: '25px',
          width: '50px',
          height: '50px',
          background: 'radial-gradient(circle, rgba(47, 128, 237, 0.9) 0%, rgba(79, 70, 229, 0.8) 100%)',
          borderRadius: '10px',
          boxShadow: '0 0 20px rgba(47, 128, 237, 0.6)',
          transform: 'translateZ(0px)',
        }} />
      </motion.div>
    </div>
  );
};
