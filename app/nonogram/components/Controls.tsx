"use client";
import React from "react";
import {
  baseBtnStyle,
  primaryBtnStyle,
  dangerBtnStyle,
  selectedBtnStyle,
  hoverBtnStyle,
} from '../buttonStyles';

type InputMode = 'fill' | 'maybe' | 'x';

type Props = {
  celebrateGrid: boolean | null;
  editorMode: boolean;
  handleClearEditor: () => void;
  clearBoard: () => void;
  handlePrevDate: () => void;
  handleNextDate: () => void;
  saveDate: string;
  setSaveDate: (s: string) => void;
  handleSave: () => void;
  inputMode: InputMode;
  setInputMode: (m: InputMode) => void;
};

const INPUT_MODES: ReadonlyArray<{ id: InputMode; label: string }> = [
  { id: 'fill', label: 'Fill' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'x', label: 'X' },
];

const iconBox: React.CSSProperties = { width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function ModeIcon({ mode }: { mode: InputMode }) {
  if (mode === 'fill') return <div style={{ ...iconBox, background: '#222', borderRadius: 2 }} />;
  if (mode === 'maybe') return <div style={iconBox}><div style={{ width: 8, height: 8, borderRadius: 6, background: '#666' }} /></div>;
  return <div style={{ ...iconBox, color: '#c53030', fontWeight: 800, fontSize: 16 }}>✕</div>;
}

export default function Controls({ celebrateGrid, editorMode, handleClearEditor, handlePrevDate, handleNextDate, saveDate, setSaveDate, handleSave, inputMode, setInputMode, clearBoard }: Props) {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [hoveredMode, setHoveredMode] = React.useState<InputMode | null>(null);

  if (celebrateGrid) return null;

  return (
    <div style={{ marginTop: 15, width: '100%', display: 'flex', justifyContent: 'center', gap: 12 }}>
      {editorMode ? (
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', color: '#000000' }}>
          <button onClick={handleClearEditor} style={dangerBtnStyle}>x</button>
          <button onClick={handlePrevDate} style={{ ...baseBtnStyle }}>‹</button>
          <button onClick={handleNextDate} style={{ ...baseBtnStyle }}>›</button>
          <input type="date" value={saveDate} onChange={e => setSaveDate(e.target.value)} style={{ width: 135, marginLeft: 2, marginRight: 2, background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px 8px' }} />
          <button onClick={handleSave} disabled={!saveDate} style={{ ...primaryBtnStyle }}>+</button>
        </div>
      ) : (
        <>
          <button aria-label="Clear board" title="Clear board" onClick={() => setShowConfirm(true)} style={{ ...dangerBtnStyle, minWidth: 56 }}>
            <div style={{ fontSize: 16, transform: 'rotate(-20deg)', fontWeight: 1500 }}>↺</div>
          </button>
          {INPUT_MODES.map(({ id, label }) => {
            const isSelected = inputMode === id;
            const isHovered = hoveredMode === id;
            const style: React.CSSProperties = { ...baseBtnStyle, minWidth: 56, textAlign: 'center' };
            if (isSelected) Object.assign(style, selectedBtnStyle);
            else if (isHovered) Object.assign(style, hoverBtnStyle);
            return (
              <button
                key={id}
                onClick={() => setInputMode(id)}
                onMouseEnter={() => setHoveredMode(id)}
                onMouseLeave={() => setHoveredMode(null)}
                style={style}
                aria-label={label}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ModeIcon mode={id} />
                </div>
              </button>
            );
          })}
        </>
      )}

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: 18, borderRadius: 8, minWidth: 280, maxWidth: 400 }}>
            <div style={{ fontFamily: 'Courier New', fontWeight: 700, marginBottom: 12, color: '#000' }}>Are you sure you want to clear the board and start over?</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowConfirm(false)} style={{ ...baseBtnStyle }}>Back</button>
              <button onClick={() => { setShowConfirm(false); clearBoard(); }} style={{ ...dangerBtnStyle }}>Start Over</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
