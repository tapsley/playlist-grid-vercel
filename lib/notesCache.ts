export type CachedNote = {
  title: string;
  body: string;
};

const dayNoteCache = new Map<string, CachedNote>();
const monthNoteCache = new Map<string, Record<string, CachedNote>>();

function toYm(date: string) {
  return date.slice(0, 7);
}

export function getCachedNote(date: string): CachedNote | undefined {
  return dayNoteCache.get(date);
}

export function setCachedNote(date: string, note: CachedNote) {
  dayNoteCache.set(date, note);

  const ym = toYm(date);
  const monthNotes = monthNoteCache.get(ym) ?? {};
  monthNoteCache.set(ym, {
    ...monthNotes,
    [date]: note,
  });
}

export function setCachedMonthNotes(notes: Record<string, CachedNote>) {
  const entries = Object.entries(notes);
  if (entries.length === 0) return;

  const ym = toYm(entries[0][0]);
  monthNoteCache.set(ym, notes);

  Object.entries(notes).forEach(([date, note]) => {
    dayNoteCache.set(date, note);
  });
}

export function getCachedMonthNotes(ym: string): Record<string, CachedNote> | undefined {
  return monthNoteCache.get(ym);
}

export function clearNotesCache() {
  dayNoteCache.clear();
  monthNoteCache.clear();
}
