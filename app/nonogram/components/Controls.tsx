"use client";
import React from "react";
import {
  baseBtnStyle,
  primaryBtnStyle,
  dangerBtnStyle,
  raisedBtnStyle,
  raisedBtnActiveStyle,
  raisedCircleBtnStyle,
  raisedCircleBtnActiveStyle,
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
  leftHandMode?: boolean;
};


const iconBox: React.CSSProperties = { width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' };

function ModeIcon({ mode, active }: { mode: InputMode; active: boolean }) {
  const color = active ? '#111' : '#444';
  if (mode === 'fill') return <div style={{ ...iconBox, background: color, borderRadius: 3 }} />;
  if (mode === 'maybe') return <div style={iconBox}><div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} /></div>;
  return <div style={{ ...iconBox, color: active ? '#b91c1c' : '#e53e3e', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>✕</div>;
}

export default function Controls({ celebrateGrid, editorMode, handleClearEditor, handlePrevDate, handleNextDate, saveDate, setSaveDate, handleSave, inputMode, setInputMode, clearBoard, leftHandMode }: Props) {
  const [showConfirm, setShowConfirm] = React.useState(false);

  if (celebrateGrid) return null;

  return (
    <div style={{ marginTop: 15, width: '100%', display: 'flex', justifyContent: 'center', gap: 12 }}>
      <style>{`
        .controls-btn-maybe { border-radius: 33px 8px 8px 33px; }
        .controls-btn-fill  { border-radius: 8px; }
        .controls-btn-x     { border-radius: 8px 33px 33px 8px; }
        .controls-lhm .controls-btn-maybe { border-radius: 8px 33px 33px 8px; }
        .controls-lhm .controls-btn-x     { border-radius: 33px 8px 8px 33px; }
      `}</style>
      {editorMode ? (
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', color: '#000000' }}>
          <button onClick={handleClearEditor} style={dangerBtnStyle}>x</button>
          <button onClick={handlePrevDate} style={{ ...baseBtnStyle }}>‹</button>
          <button onClick={handleNextDate} style={{ ...baseBtnStyle }}>›</button>
          <input type="date" value={saveDate} onChange={e => setSaveDate(e.target.value)} style={{ width: 135, marginLeft: 2, marginRight: 2, background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px 8px' }} />
          <button onClick={handleSave} disabled={!saveDate} style={{ ...primaryBtnStyle }}>+</button>
        </div>
      ) : (
        <div className={leftHandMode ? 'controls-lhm' : undefined} style={{ display: 'flex', flexDirection: leftHandMode ? 'row-reverse' : 'row', gap: 16 }}>
          <button
            aria-label="Clear board"
            title="Clear board"
            onClick={() => setShowConfirm(true)}
            style={showConfirm ? raisedCircleBtnActiveStyle : raisedCircleBtnStyle}
          >
            <div style={{ paddingTop: '6px', fontSize: 27, color: '#e53e3e', lineHeight: 2 }}>↺</div>
          </button>
          {(['maybe', 'fill', 'x'] as InputMode[]).map(id => {
            const isSelected = inputMode === id;
            const handleClick = () => {
              if (id === 'fill' && inputMode === 'fill') setInputMode('x');
              else if (id === 'x' && inputMode === 'x') setInputMode('fill');
              else setInputMode(id);
            };
            return (
              <button
                key={id}
                onClick={handleClick}
                className={`controls-btn-${id}`}
                style={{ ...(isSelected ? raisedBtnActiveStyle : raisedBtnStyle), borderRadius: undefined }}
                aria-label={id}
              >
                <ModeIcon mode={id} active={isSelected} />
              </button>
            );
          })}
        </div>
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
