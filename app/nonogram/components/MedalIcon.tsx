import React from 'react';

export default function MedalIcon({ type, size = 20 }: { type: 'gold' | 'silver'; size?: number }) {
  const disc   = type === 'gold' ? '#D4AF37' : '#7C3AED';
  const ribbon = type === 'gold' ? '#B0B0B0' : '#B0B0B0';
  const stroke = type === 'gold' ? '#A08000' : '#5B21B6';

  return (
    <svg width={size} height={Math.round(size * 1.4)} viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(180 10 14)">
        {/* Ribbon tails — drawn first so the disc covers their tops */}
        <polygon points="7.5,15 10,15 6,26 3,26" fill={ribbon} />
        <polygon points="10,15 12.5,15 17,26 14,26" fill={ribbon} />
        {/* Medal disc */}
        <circle cx="10" cy="9" r="7.5" fill={disc} stroke={stroke} strokeWidth="0.75" />
      </g>
    </svg>
  );
}
