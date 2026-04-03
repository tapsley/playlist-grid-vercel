// Simple client-side settings persistence for Picross
export type PicrossSettings = {
  playStartAnimation?: boolean;
  showTimer?: boolean;
};

const KEY = 'picross:settings:v1';

export function getPicrossSettings(): PicrossSettings {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null;
    if (!raw) return { playStartAnimation: true, showTimer: true };
    const parsed = JSON.parse(raw || '{}');
    return { playStartAnimation: parsed.playStartAnimation !== false, showTimer: parsed.showTimer !== false };
  } catch {
    return { playStartAnimation: true, showTimer: true };
  }
}

export function setPicrossSettings(partial: PicrossSettings) {
  try {
    const cur = getPicrossSettings();
    const next = { ...cur, ...partial };
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    // Fire-and-forget server persist for authenticated users
    try {
      (async () => {
        try {
          await fetch('/api/user/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: next }) });
        } catch (err) {
          console.debug('persist user settings failed', err);
        }
      })();
    } catch {}
    return next;
  } catch {
    return { playStartAnimation: true };
  }
}

export default { getPicrossSettings, setPicrossSettings };
