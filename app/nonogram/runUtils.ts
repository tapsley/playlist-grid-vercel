// Pure helpers for run/clue analysis used by the play UI.
export type IsFilledFn = (r: number, c: number) => boolean;
export type IsXFn = (r: number, c: number) => boolean;
export type RunMeta = { len: number; start: number; end: number; bounded: boolean };

export const generatePlacements = (
  clues: number[],
  size: number,
  isRow: boolean,
  idx: number,
  isFilledCell: IsFilledFn,
  isXCell: IsXFn,
) => {
  const placements: number[][] = [];
  const totalClues = clues.length;
  const sumRemaining: number[] = new Array(totalClues + 1).fill(0);
  for (let i = totalClues - 1; i >= 0; i--) sumRemaining[i] = sumRemaining[i + 1] + clues[i];

  const coversAllFilled = (starts: number[]) => {
    const segs: Array<[number, number]> = [];
    for (let k = 0; k < starts.length; k++) segs.push([starts[k], starts[k] + clues[k] - 1]);
    for (let pos = 0; pos < size; pos++) {
      if (isRow ? isFilledCell(idx, pos) : isFilledCell(pos, idx)) {
        let covered = false;
        for (const s of segs) {
          if (pos >= s[0] && pos <= s[1]) { covered = true; break; }
        }
        if (!covered) return false;
      }
    }
    return true;
  };

  const backtrack = (k: number, starts: number[]) => {
    if (k === totalClues) {
      if (coversAllFilled(starts)) placements.push([...starts]);
      return;
    }
    const minStart = k === 0 ? 0 : starts[k - 1] + clues[k - 1] + 1;
    const maxStart = size - (sumRemaining[k] + (totalClues - k - 1));
    for (let s = minStart; s <= maxStart; s++) {
      let conflict = false;
      for (let p = s; p < s + clues[k]; p++) {
        if (isRow ? isXCell(idx, p) : isXCell(p, idx)) { conflict = true; break; }
      }
      if (conflict) continue;
      starts.push(s);
      backtrack(k + 1, starts);
      starts.pop();
    }
  };

  if (totalClues === 0) {
    for (let pos = 0; pos < size; pos++) if (isRow ? isFilledCell(idx, pos) : isFilledCell(pos, idx)) return [];
    return [[]];
  }
  backtrack(0, []);
  return placements;
};

export const computeFulfilledArray = (
  clues: number[],
  runs: number[],
  meta: Array<{ len: number; start: number; end: number; bounded: boolean }>,
  size: number,
  isFilledCell: IsFilledFn,
  isXCell: IsXFn,
  isRow?: boolean,
  idx?: number,
) => {
  const anyFilled = meta.length > 0;
  const fulfilledArr: boolean[] = [];

  const usedMeta: boolean[] = new Array(meta.length).fill(false);

  for (let j = 0; j < clues.length; j++) {
    const n = clues[j];
    let fulfilled = false;
    if (n === 0) fulfilled = !anyFilled;
    else {
      if (runs.length === clues.length && typeof runs[j] !== 'undefined' && runs[j] === n) {
        fulfilled = true;
        if (meta[j]) usedMeta[j] = true;
      }
    }
    fulfilledArr.push(fulfilled);
  }

  let placements: number[][] | undefined;
  if (typeof idx === 'number' && typeof isRow === 'boolean') {
    try {
      placements = generatePlacements(clues, size, !!isRow, idx, isFilledCell, isXCell);
      if (placements && placements.length > 0) {
        for (let j = 0; j < clues.length; j++) {
          if (fulfilledArr[j]) continue;
          let alwaysFullyFilled = true;
          for (const p of placements) {
            const start = p[j];
            const end = start + clues[j] - 1;
            for (let pos = start; pos <= end; pos++) {
              if (isRow ? !isFilledCell(idx, pos) : !isFilledCell(pos, idx)) { alwaysFullyFilled = false; break; }
            }
            if (!alwaysFullyFilled) break;
          }
          if (alwaysFullyFilled) fulfilledArr[j] = true;
        }

        for (let mi = 0; mi < meta.length; mi++) {
          const m = meta[mi];
          if (!m) continue;
          let consistentIndex: number | null = null;
          let allHaveMapping = true;
          for (const p of placements) {
            let found = -1;
            for (let j = 0; j < clues.length; j++) {
              const start = p[j];
              const end = start + clues[j] - 1;
              if (start === m.start && end === m.end) { found = j; break; }
            }
            if (found === -1) { allHaveMapping = false; break; }
            if (consistentIndex === null) consistentIndex = found;
            else if (consistentIndex !== found) { allHaveMapping = false; break; }
          }
          if (allHaveMapping && consistentIndex !== null) {
            let allFilled = true;
            for (let pos = m.start; pos <= m.end; pos++) {
              if (isRow ? !isFilledCell(idx, pos) : !isFilledCell(pos, idx)) { allFilled = false; break; }
            }
            if (allFilled) fulfilledArr[consistentIndex] = true;
          }
        }
      }
    } catch (e) {
      // fall back to best-effort fulfilledArr
    }
  }

  const allFulfilled = fulfilledArr.every(Boolean);
  if (!allFulfilled && placements && placements.length > 0 && typeof isRow === 'boolean' && typeof idx === 'number') {
    for (let j = 0; j < clues.length; j++) {
      if (clues[j] === 1 && fulfilledArr[j]) {
        let bounded = false;
        const m = meta[j];
        if (m && m.bounded) bounded = true;
        if (!bounded) {
          bounded = placements.every(p => {
            const start = p[j];
            const end = start;
            const leftBound = start === 0 || (isRow ? isXCell(idx, start - 1) : isXCell(start - 1, idx));
            const rightBound = end === size - 1 || (isRow ? isXCell(idx, end + 1) : isXCell(end + 1, idx));
            return leftBound && rightBound;
          });
        }
        if (!bounded) fulfilledArr[j] = false;
      }
    }
  }

  return fulfilledArr;
};
