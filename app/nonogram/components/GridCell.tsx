"use client";
import React from "react";

type Props = {
  r: number;
  c: number;
  cell: any;
  cellPx: number;
  celebrateGrid: any;
  editorMode: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerEnter: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  cellStyle: React.CSSProperties;
};

export default function GridCell({ r, c, cell, cellPx, celebrateGrid, editorMode, onPointerDown, onPointerEnter, onContextMenu, cellStyle }: Props) {
  return (
    <div
      data-picross-cell
      data-r={String(r)}
      data-c={String(c)}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onContextMenu={onContextMenu}
      style={cellStyle}
    >
      {!editorMode && (cell as any) === 3 && (
        <div style={{ color: '#c53030', fontWeight: 800, fontSize: Math.round(cellPx * 0.7), lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateY(2px)' }}>✕</div>
      )}
      {!editorMode && (cell as any) === 2 && (
        <div style={{ width: Math.max(6, Math.round(cellPx * 0.25)), height: Math.max(6, Math.round(cellPx * 0.25)), borderRadius: 6, background: '#666' }} />
      )}
      {celebrateGrid && celebrateGrid[r] && celebrateGrid[r][c] && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }} />
      )}
    </div>
  );
}
