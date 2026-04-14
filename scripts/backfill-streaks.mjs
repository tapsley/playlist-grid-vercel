/**
 * One-time backfill: compute currentStreak, maxStreak, lastSolved per difficulty
 * from historical PicrossProgress rows and write them into PicrossStats.
 *
 * Run from the project root:
 *   node scripts/backfill-streaks.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

// ---------------------------------------------------------------------------
// Load .env so DIRECT_URL is available
// ---------------------------------------------------------------------------
async function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Streak computation (mirrors progress POST logic)
// ---------------------------------------------------------------------------
function getMSTDateString(d) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(d ?? new Date());
  } catch {
    return (d ?? new Date()).toISOString().slice(0, 10);
  }
}

/**
 * Given a sorted array of unique date strings (YYYY-MM-DD), compute
 * currentStreak (as of today MST) and maxStreak.
 */
function computeStreaks(sortedDays) {
  if (sortedDays.length === 0) return { current: 0, max: 0, lastSolved: null };

  // Max streak
  let maxStreak = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const a = new Date(sortedDays[i - 1]);
    const b = new Date(sortedDays[i]);
    const diff = Math.round((b - a) / 86400000);
    if (diff === 1) {
      run++;
      if (run > maxStreak) maxStreak = run;
    } else {
      run = 1;
    }
  }

  const todayStr = getMSTDateString();
  const yest = new Date(todayStr);
  yest.setDate(yest.getDate() - 1);
  const yesterStr = yest.toISOString().slice(0, 10);

  const daySet = new Set(sortedDays);
  const lastSolved = sortedDays[sortedDays.length - 1];

  // Current streak: walk back from today (or yesterday if not solved today)
  let current = 0;
  if (daySet.has(todayStr) || daySet.has(yesterStr)) {
    let check = daySet.has(todayStr) ? todayStr : yesterStr;
    while (daySet.has(check)) {
      current++;
      const d = new Date(check);
      d.setDate(d.getDate() - 1);
      check = d.toISOString().slice(0, 10);
    }
  }

  return { current, max: maxStreak, lastSolved };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
await loadEnv();
const prisma = new PrismaClient({ log: ["error", "warn"] });

try {
  // Fetch all completion rows grouped by userId
  const allProgress = await prisma.picrossProgress.findMany({
    select: { userId: true, date: true, easyComplete: true, mediumComplete: true, hardComplete: true },
    orderBy: { date: "asc" },
  });

  // Group by user
  const byUser = new Map();
  for (const row of allProgress) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId).push(row);
  }

  let updated = 0;
  let skipped = 0;

  for (const [userId, rows] of byUser) {
    const easyDays = [...new Set(rows.filter(r => r.easyComplete).map(r => r.date.toISOString().slice(0, 10)))].sort();
    const mediumDays = [...new Set(rows.filter(r => r.mediumComplete).map(r => r.date.toISOString().slice(0, 10)))].sort();
    const hardDays = [...new Set(rows.filter(r => r.hardComplete).map(r => r.date.toISOString().slice(0, 10)))].sort();

    const easy = computeStreaks(easyDays);
    const medium = computeStreaks(mediumDays);
    const hard = computeStreaks(hardDays);

    const existingStats = await prisma.picrossStats.findUnique({ where: { userId } });
    if (!existingStats) {
      skipped++;
      console.log(`  SKIP  userId=${userId} (no PicrossStats row — will be created on next solve)`);
      continue;
    }

    await prisma.picrossStats.update({
      where: { userId },
      data: {
        currentStreakEasy: easy.current,
        maxStreakEasy: easy.max,
        lastSolvedEasy: easy.lastSolved ? new Date(easy.lastSolved) : null,
        currentStreakMedium: medium.current,
        maxStreakMedium: medium.max,
        lastSolvedMedium: medium.lastSolved ? new Date(medium.lastSolved) : null,
        currentStreakHard: hard.current,
        maxStreakHard: hard.max,
        lastSolvedHard: hard.lastSolved ? new Date(hard.lastSolved) : null,
      },
    });

    updated++;
    console.log(`  OK    userId=${userId}  easy=${easy.current}/${easy.max}  medium=${medium.current}/${medium.max}  hard=${hard.current}/${hard.max}`);
  }

  console.log(`\nDone. Updated: ${updated}  Skipped (no stats row): ${skipped}`);
} finally {
  await prisma.$disconnect();
}
