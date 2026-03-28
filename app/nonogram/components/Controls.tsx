"use client";
import React from "react";

type Props = {
  celebrateGrid: boolean | null;
  editorMode: boolean;
  handleClearEditor: () => void;
  handlePrevDate: () => void;
  handleNextDate: () => void;
  saveDate: string;
  setSaveDate: (s: string) => void;
  handleSave: () => void;
  inputMode: 'fill' | 'maybe' | 'x';
  setInputMode: (m: 'fill' | 'maybe' | 'x') => void;
  hoveredMode: string | null;
  setHoveredMode: (m: string | null) => void;
  baseBtnStyle: React.CSSProperties;
  primaryBtnStyle: React.CSSProperties;
  dangerBtnStyle: React.CSSProperties;
  selectedBtnStyle: React.CSSProperties;
  hoverBtnStyle: React.CSSProperties;
};

export default function Controls(props: Props) {
  const { celebrateGrid, editorMode, handleClearEditor, handlePrevDate, handleNextDate, saveDate, setSaveDate, handleSave, inputMode, setInputMode, hoveredMode, setHoveredMode, baseBtnStyle, primaryBtnStyle, dangerBtnStyle, selectedBtnStyle, hoverBtnStyle } = props;

  if (celebrateGrid) return null;

  return (
    <div style={{ marginTop: 15, width: '100%', display: 'flex', justifyContent: 'center', gap: 12 }}>
      {editorMode ? (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={handleClearEditor} style={dangerBtnStyle}>Clear</button>
          <button onClick={handlePrevDate} style={{ ...baseBtnStyle }}>Previous</button>
          <button onClick={handleNextDate} style={{ ...baseBtnStyle }}>Next</button>
          <input type="date" value={saveDate} onChange={e => setSaveDate(e.target.value)} style={{ marginLeft: 8, marginRight: 8 }} />
          <button onClick={handleSave} disabled={!saveDate} style={{ ...primaryBtnStyle }}>Save</button>
        </div>
      ) : (
        (['fill', 'maybe', 'x'] as const).map(m => {
          let icon: React.ReactNode = null;
          const iconBox: React.CSSProperties = { width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' };
          if (m === 'fill') {
            icon = <div style={{ ...iconBox, background: '#222', borderRadius: 2 }} />;
          } else if (m === 'maybe') {
            icon = (
              <div style={iconBox}>
                <div style={{ width: 8, height: 8, borderRadius: 6, background: '#666' }} />
              </div>
            );
          } else {
            icon = <div style={{ ...iconBox, color: '#c53030', fontWeight: 800, fontSize: 16 }}>✕</div>;
          }
          const label = m === 'fill' ? 'Fill' : m === 'maybe' ? 'Maybe' : 'X';
          const isSelected = inputMode === m;
          const isHovered = hoveredMode === m;
          const style: React.CSSProperties = { ...baseBtnStyle, minWidth: 56, textAlign: 'center' };
          if (isSelected) Object.assign(style, selectedBtnStyle);
          else if (isHovered) Object.assign(style, hoverBtnStyle);
          return (
            <button
              key={m}
              onClick={() => setInputMode(m)}
              onMouseEnter={() => setHoveredMode(m)}
              onMouseLeave={() => setHoveredMode(null)}
              style={style}
              aria-label={label}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
