type Cell = [number, number];

function key(r: number, c: number) { return `${r},${c}`; }

function snakeRows(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r,c])=>key(r,c)));
  const out: Cell[] = [];
  for (let r = 0; r < size; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < size; c++) if (set.has(key(r,c))) out.push([r,c]);
    } else {
      for (let c = size - 1; c >= 0; c--) if (set.has(key(r,c))) out.push([r,c]);
    }
  }
  return out;
}

function rainColumns(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r,c])=>key(r,c)));
  const out: Cell[] = [];
  // column-major: each column cascades top->bottom, columns left->right
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) {
      if (set.has(key(r,c))) out.push([r,c]);
    }
  }
  return out;
}

function diagRain(filled: Cell[], size: number): Cell[] {
  // sort by r+c (diagonals), then by c to create sweeping diagonals
  const copy = filled.slice();
  copy.sort((a,b) => {
    const sa = a[0]+a[1];
    const sb = b[0]+b[1];
    if (sa !== sb) return sa - sb;
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[0] - b[0];
  });
  return copy;
}

function centerOut(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r,c])=>key(r,c)));
  // compute numeric distance for each filled cell from center
  const center = (size - 1) / 2;
  const items = filled.map(([r,c]) => ({ r, c, dist: Math.max(Math.abs(r - center), Math.abs(c - center)) }));
  // group by distance and iterate from inner to outer
  const uniqueDists = Array.from(new Set(items.map(it => it.dist))).sort((a,b) => a - b);
  const out: Cell[] = [];
  for (const d of uniqueDists) {
    const group = items.filter(it => it.dist === d).sort((a,b) => (a.r - b.r) || (a.c - b.c));
    for (const g of group) {
      if (set.has(key(g.r, g.c))) out.push([g.r, g.c]);
    }
  }
  return out;
}

function shuffle(filled: Cell[]): Cell[] {
  const a = filled.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function verticalSnake(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r,c])=>key(r,c)));
  const out: Cell[] = [];
  for (let c = 0; c < size; c++) {
    if (c % 2 === 0) {
      for (let r = 0; r < size; r++) if (set.has(key(r,c))) out.push([r,c]);
    } else {
      for (let r = size - 1; r >= 0; r--) if (set.has(key(r,c))) out.push([r,c]);
    }
  }
  return out;
}

function spiralInward(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r,c])=>key(r,c)));
  const out: Cell[] = [];
  let top = 0, left = 0, right = size - 1, bottom = size - 1;
  while (left <= right && top <= bottom) {
    // left->right across top
    for (let c = left; c <= right; c++) if (set.has(key(top,c))) out.push([top,c]);
    top++;
    // top->bottom down right
    for (let r = top; r <= bottom; r++) if (set.has(key(r,right))) out.push([r,right]);
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) if (set.has(key(bottom,c))) out.push([bottom,c]);
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) if (set.has(key(r,left))) out.push([r,left]);
      left++;
    }
  }
  return out;
}

function checkerboard(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r,c])=>key(r,c)));
  const out: Cell[] = [];
  // first parity then the other
  for (let parity = 0; parity <= 1; parity++) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (((r + c) % 2) === parity && set.has(key(r,c))) out.push([r,c]);
      }
    }
  }
  return out;
}

function spiralOutward(filled: Cell[], size: number): Cell[] {
  const inOrd = spiralInward(filled, size);
  return inOrd.slice().reverse();
}

function borderOut(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r,c])=>key(r,c)));
  const items = filled.map(([r,c]) => ({ r, c, dist: Math.max(r, c, size - 1 - r, size - 1 - c) }));
  items.sort((a,b) => b.dist - a.dist || a.r - b.r || a.c - b.c);
  return items.map(it => [it.r, it.c] as Cell);
}

function zipColumns(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r,c])=>key(r,c)));
  const out: Cell[] = [];
  let left = 0, right = size - 1;
  while (left <= right) {
    for (let r = 0; r < size; r++) if (set.has(key(r,left))) out.push([r,left]);
    if (left !== right) {
      for (let r = 0; r < size; r++) if (set.has(key(r,right))) out.push([r,right]);
    }
    left++; right--;
  }
  return out;
}

function rowShuffle(filled: Cell[], size: number): Cell[] {
  const rowsMap = new Map<number, Cell[]>();
  for (const [r,c] of filled) {
    const arr = rowsMap.get(r) ?? [];
    arr.push([r,c]);
    rowsMap.set(r, arr);
  }
  const rows = Array.from(rowsMap.keys());
  // shuffle rows order
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp;
  }
  const out: Cell[] = [];
  for (const r of rows) {
    const rowCells = rowsMap.get(r) || [];
    // left->right within row
    rowCells.sort((a,b) => a[1] - b[1]);
    out.push(...rowCells);
  }
  return out;
}

function diagReverse(filled: Cell[], _size: number): Cell[] {
  const copy = filled.slice();
  copy.sort((a, b) => {
    const sa = a[0] + a[1];
    const sb = b[0] + b[1];
    if (sa !== sb) return sb - sa;
    if (a[1] !== b[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  return copy;
}

function bottomUp(filled: Cell[], size: number): Cell[] {
  const set = new Set(filled.map(([r, c]) => key(r, c)));
  const out: Cell[] = [];
  for (let c = 0; c < size; c++) {
    for (let r = size - 1; r >= 0; r--) {
      if (set.has(key(r, c))) out.push([r, c]);
    }
  }
  return out;
}

function burst(filled: Cell[], _size: number): Cell[] {
  if (filled.length === 0) return filled;
  const [er, ec] = filled[Math.floor(Math.random() * filled.length)];
  return filled.slice().sort((a, b) =>
    ((a[0] - er) ** 2 + (a[1] - ec) ** 2) - ((b[0] - er) ** 2 + (b[1] - ec) ** 2)
  );
}

function splitReveal(filled: Cell[], size: number): Cell[] {
  const mid = size / 2;
  const top = filled.filter(([r]) => r < mid).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const bot = filled.filter(([r]) => r >= mid).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const out: Cell[] = [];
  const maxLen = Math.max(top.length, bot.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < top.length) out.push(top[i]);
    if (i < bot.length) out.push(bot[i]);
  }
  return out;
}

function waveSweep(filled: Cell[], size: number): Cell[] {
  // produce a wave-like ordering by using sin on row index to offset column priority
  const copy = filled.slice();
  copy.sort((a,b) => {
    const scoreA = a[1] + Math.sin(a[0] / Math.max(1, size) * Math.PI * 2) * 0.5;
    const scoreB = b[1] + Math.sin(b[0] / Math.max(1, size) * Math.PI * 2) * 0.5;
    if (scoreA !== scoreB) return scoreA - scoreB;
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
  return copy;
}

export default function pickSequence(filled: Cell[], size: number): { order: Cell[]; name: string } {
  if (!filled || filled.length === 0) return { order: [], name: 'none' };
  const r = Math.random() * 100;
  let fn: (f:Cell[], s:number)=>Cell[];
  let name = 'shuffle';
  if      (r < 12) { fn = waveSweep;     name = 'waveSweep'; }
  else if (r < 22) { fn = checkerboard;  name = 'checkerboard'; }
  else if (r < 30) { fn = shuffle;       name = 'shuffle'; }
  else if (r < 37) { fn = diagRain;      name = 'diagRain'; }
  else if (r < 44) { fn = centerOut;     name = 'centerOut'; }
  else if (r < 50) { fn = diagReverse;   name = 'diagReverse'; }
  else if (r < 56) { fn = burst;         name = 'burst'; }
  else if (r < 61) { fn = spiralOutward; name = 'spiralOutward'; }
  else if (r < 66) { fn = splitReveal;   name = 'splitReveal'; }
  else if (r < 71) { fn = zipColumns;    name = 'zipColumns'; }
  else if (r < 76) { fn = borderOut;     name = 'borderOut'; }
  else if (r < 80) { fn = rowShuffle;    name = 'rowShuffle'; }
  else if (r < 83) { fn = bottomUp;      name = 'bottomUp'; }
  else if (r < 86) { fn = snakeRows;     name = 'snakeRows'; }
  else if (r < 89) { fn = rainColumns;   name = 'rainColumns'; }
  else if (r < 91) { fn = verticalSnake; name = 'verticalSnake'; }
  else              { fn = spiralInward;  name = 'spiralInward'; }
  return { order: fn(filled, size), name };
}
