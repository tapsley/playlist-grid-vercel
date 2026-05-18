/** Centralised localStorage key builders for all picross data. */

export const storageKeys = {
  seconds:     (dateStr: string, difficulty: string) => `picross:seconds:${dateStr}:${difficulty}`,
  progress:    (dateStr: string, difficulty: string) => `picross:progress:${dateStr}:${difficulty}`,
  startShown:  (dateStr: string, difficulty: string) => `picross:startShown:${dateStr}:${difficulty}`,
  fastest:     (difficulty: string)                  => `picross:fastest:${difficulty}`,
  lastLoaded:  () => 'picross:lastLoadedDate',
} as const;
