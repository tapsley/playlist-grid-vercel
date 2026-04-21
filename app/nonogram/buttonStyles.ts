import type React from 'react';

export const baseBtnStyle: React.CSSProperties = {
  fontFamily: 'Courier New',
  fontWeight: 700,
  padding: '8px 10px',
  borderRadius: 6,
  background: '#fff',
  color: '#000',
  border: '0px solid #ddd',
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

export const selectedBtnStyle: React.CSSProperties = {
  boxShadow: 'inset 0 0 0 3px #000000',
  background: '#ffffff',
  color: '#ffffff00',
};

export const hoverBtnStyle: React.CSSProperties = {
  background: '#fafafa',
};
