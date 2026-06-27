import type React from 'react';

export const baseBtnStyle: React.CSSProperties = {
  fontFamily: 'Courier New',
  fontWeight: 700,
  padding: '8px 10px',
  borderRadius: 6,
  background: '#fff',
  color: '#000',
  border: 'none',
  cursor: 'pointer',
};

export const primaryBtnStyle: React.CSSProperties = {
  ...baseBtnStyle,
  background: '#4a90e2',
  color: '#fff',
  border: 'none',
};

export const dangerBtnStyle: React.CSSProperties = {
  ...baseBtnStyle,
  background: '#fff',
  border: '2px solid #f44336',
  color: '#f44336',
};

// ── Raised / 3-D input-mode buttons ──────────────────────────────────────────

const raisedBase: React.CSSProperties = {
  width: 75,
  height: 75,
  padding: 0,
  border: '2px solid #000000',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none' as const,
  transition: 'transform 0.07s ease, box-shadow 0.07s ease, background 0.07s ease',
};

export const raisedBtnStyle: React.CSSProperties = {
  ...raisedBase,
  borderRadius: 8,
  background: 'linear-gradient(to bottom, #f8f8f8, #ffffff)',
  boxShadow: '0 2px 0 #888, 0 4px 0 #333, 0 6px 0 #888, 0 8px 0 #333, 0 10px 0 #888, 0 12px 0 #333, 0 7px 10px rgba(0,0,0,0.2)',
};

export const raisedBtnActiveStyle: React.CSSProperties = {
  ...raisedBase,
  borderRadius: 8,
  border: '2px solid #dbdbdb',
  background: '#ffffff',
  boxShadow: '0 1px 0 #9a9a9a, 0 2px 4px rgba(0,0,0,0.15)',
  transform: 'translateY(8px)',
};

export const raisedCircleBtnStyle: React.CSSProperties = {
  ...raisedBtnStyle,
  width: 50,
  height: 50,
  border: '2px solid #ff0000',
  boxShadow: '0 2px 0 #888, 0 4px 0 #333, 0 6px 0 #888, 0 7px 10px rgba(0,0,0,0.2)',
  background: 'linear-gradient(to bottom, #ffeaea, #fddfdf)',
  borderRadius: '50%',
};

export const raisedCircleBtnActiveStyle: React.CSSProperties = {
  ...raisedBtnActiveStyle,
  background: 'linear-gradient(to bottom, #fdaaaa, #ffa2a2)',
  border: '2px solid #ff0000',
  width: 50,
  height: 50,
  borderRadius: '50%',
};
