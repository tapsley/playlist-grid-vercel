import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getMSTDateString } from "@/app/nonogram/time";

function computeNewStreak(
  todayStr: string,
  lastSolved: Date | null | undefined,
  currentStreak: number,
  maxStreak: number
): { current: number; max: number; lastSolvedDate: Date } {
  const lastStr = lastSolved ? lastSolved.toISOString().slice(0, 10) : null;
  const yest = new Date(todayStr);
  yest.setDate(yest.getDate() - 1);
  const yesterStr = yest.toISOString().slice(0, 10);

  let newCurrent: number;
  if (lastStr === todayStr) {
    newCurrent = currentStreak; // already counted today
  } else if (lastStr === yesterStr) {
    newCurrent = currentStreak + 1; // consecutive day
  } else {
    newCurrent = 1; // gap — start fresh
  }
  return { current: newCurrent, max: Math.max(maxStreak, newCurrent), lastSolvedDate: new Date(todayStr) };
}

// GET /api/picross/progress?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) return new Response("Missing date", { status: 400 });
  const date = new Date(dateStr);
  const progress = await prisma.picrossProgress.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
  });
  return Response.json(progress);
}

// POST /api/picross/progress
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const body = await req.json();
  const { date, easy, medium, hard, easyComplete, mediumComplete, hardComplete, easySeconds, mediumSeconds, hardSeconds } = body;
  if (!date) return new Response("Missing date", { status: 400 });
  // If a progress row exists, only update the difficulties provided in the request.
  const existing = await prisma.picrossProgress.findUnique({
    where: { userId_date: { userId: session.user.id, date: new Date(date) } },
  });

  const defaultEasy = Array(5).fill(0).map(() => Array(5).fill(0));
  const defaultMedium = Array(10).fill(0).map(() => Array(10).fill(0));
  const defaultHard = Array(15).fill(0).map(() => Array(15).fill(0));

  const easyGrid = easy ?? (existing?.easy as any) ?? defaultEasy;
  const mediumGrid = medium ?? (existing?.medium as any) ?? defaultMedium;
  const hardGrid = hard ?? (existing?.hard as any) ?? defaultHard;

  const easyCompleteFlag = typeof easyComplete === "boolean" ? easyComplete : (existing?.easyComplete ?? false);
  const mediumCompleteFlag = typeof mediumComplete === "boolean" ? mediumComplete : (existing?.mediumComplete ?? false);
  const hardCompleteFlag = typeof hardComplete === "boolean" ? hardComplete : (existing?.hardComplete ?? false);

  const easySecondsVal = typeof easySeconds === 'number' ? Math.max(0, Math.trunc(easySeconds)) : (existing?.easySeconds ?? 0);
  const mediumSecondsVal = typeof mediumSeconds === 'number' ? Math.max(0, Math.trunc(mediumSeconds)) : (existing?.mediumSeconds ?? 0);
  const hardSecondsVal = typeof hardSeconds === 'number' ? Math.max(0, Math.trunc(hardSeconds)) : (existing?.hardSeconds ?? 0);

  // Compute per-difficulty increment/decrement for solved counters
  const incValue = (flag: boolean, existingFlag: boolean | undefined) => {
    if (typeof existingFlag === 'undefined') return flag ? 1 : 0;
    if (!existingFlag && flag) return 1;
    if (existingFlag && !flag) return -1;
    return 0;
  };

  const incEasy = incValue(easyCompleteFlag, existing?.easyComplete);
  const incMedium = incValue(mediumCompleteFlag, existing?.mediumComplete);
  const incHard = incValue(hardCompleteFlag, existing?.hardComplete);

  // Perform progress upsert and stats update in a transaction to keep counters consistent
  let progress;
  try {
    progress = await prisma.$transaction(async (tx) => {
      let progressRec;
      if (existing) {
        progressRec = await tx.picrossProgress.update({
          where: { id: existing.id },
          data: {
            easy: easyGrid,
            medium: mediumGrid,
            hard: hardGrid,
            easyComplete: easyCompleteFlag,
            mediumComplete: mediumCompleteFlag,
            hardComplete: hardCompleteFlag,
            easySeconds: easySecondsVal,
            mediumSeconds: mediumSecondsVal,
            hardSeconds: hardSecondsVal,
          },
        });
      } else {
        progressRec = await tx.picrossProgress.create({
          data: {
            user: { connect: { id: session.user.id } },
            date: new Date(date),
            easy: easyGrid,
            medium: mediumGrid,
            hard: hardGrid,
            easyComplete: easyCompleteFlag,
            mediumComplete: mediumCompleteFlag,
            hardComplete: hardCompleteFlag,
            easySeconds: easySecondsVal,
            mediumSeconds: mediumSecondsVal,
            hardSeconds: hardSecondsVal,
          },
        });
      }

      // Update or create stats row with solved counters, fastest times, and streaks
      if (incEasy !== 0 || incMedium !== 0 || incHard !== 0 || (easySecondsVal > 0) || (mediumSecondsVal > 0) || (hardSecondsVal > 0)) {
        const todayStr = getMSTDateString();
        const stats = await tx.picrossStats.findUnique({ where: { userId: session.user.id } });
        if (!stats) {
          const createData: any = { user: { connect: { id: session.user.id } }, solvedEasy: Math.max(0, incEasy), solvedMedium: Math.max(0, incMedium), solvedHard: Math.max(0, incHard) };
          if (easyCompleteFlag && easySecondsVal > 0) createData.fastestEasy = easySecondsVal;
          if (mediumCompleteFlag && mediumSecondsVal > 0) createData.fastestMedium = mediumSecondsVal;
          if (hardCompleteFlag && hardSecondsVal > 0) createData.fastestHard = hardSecondsVal;
          if (incEasy > 0) { createData.currentStreakEasy = 1; createData.maxStreakEasy = 1; createData.lastSolvedEasy = new Date(todayStr); }
          if (incMedium > 0) { createData.currentStreakMedium = 1; createData.maxStreakMedium = 1; createData.lastSolvedMedium = new Date(todayStr); }
          if (incHard > 0) { createData.currentStreakHard = 1; createData.maxStreakHard = 1; createData.lastSolvedHard = new Date(todayStr); }
          await tx.picrossStats.create({ data: createData });
        } else {
          const updates: any = {};
          if (incEasy !== 0) updates.solvedEasy = Math.max(0, (stats.solvedEasy ?? 0) + incEasy);
          if (incMedium !== 0) updates.solvedMedium = Math.max(0, (stats.solvedMedium ?? 0) + incMedium);
          if (incHard !== 0) updates.solvedHard = Math.max(0, (stats.solvedHard ?? 0) + incHard);
          if (easyCompleteFlag && easySecondsVal > 0 && (!stats.fastestEasy || easySecondsVal < stats.fastestEasy)) updates.fastestEasy = easySecondsVal;
          if (mediumCompleteFlag && mediumSecondsVal > 0 && (!stats.fastestMedium || mediumSecondsVal < stats.fastestMedium)) updates.fastestMedium = mediumSecondsVal;
          if (hardCompleteFlag && hardSecondsVal > 0 && (!stats.fastestHard || hardSecondsVal < stats.fastestHard)) updates.fastestHard = hardSecondsVal;
          if (incEasy > 0) {
            const s = computeNewStreak(todayStr, stats.lastSolvedEasy, stats.currentStreakEasy ?? 0, stats.maxStreakEasy ?? 0);
            updates.currentStreakEasy = s.current; updates.maxStreakEasy = s.max; updates.lastSolvedEasy = s.lastSolvedDate;
          }
          if (incMedium > 0) {
            const s = computeNewStreak(todayStr, stats.lastSolvedMedium, stats.currentStreakMedium ?? 0, stats.maxStreakMedium ?? 0);
            updates.currentStreakMedium = s.current; updates.maxStreakMedium = s.max; updates.lastSolvedMedium = s.lastSolvedDate;
          }
          if (incHard > 0) {
            const s = computeNewStreak(todayStr, stats.lastSolvedHard, stats.currentStreakHard ?? 0, stats.maxStreakHard ?? 0);
            updates.currentStreakHard = s.current; updates.maxStreakHard = s.max; updates.lastSolvedHard = s.lastSolvedDate;
          }
          if (Object.keys(updates).length) {
            await tx.picrossStats.update({ where: { id: stats.id }, data: updates });
          }
        }
      }

      return progressRec;
    });
  } catch (err) {
    console.debug('transactional progress/stats update failed', err);
    // fallback to best-effort non-transactional update
    if (existing) {
      progress = await prisma.picrossProgress.update({ where: { id: existing.id }, data: { easy: easyGrid, medium: mediumGrid, hard: hardGrid, easyComplete: easyCompleteFlag, mediumComplete: mediumCompleteFlag, hardComplete: hardCompleteFlag, easySeconds: easySecondsVal, mediumSeconds: mediumSecondsVal, hardSeconds: hardSecondsVal } });
    } else {
      progress = await prisma.picrossProgress.create({ data: { user: { connect: { id: session.user.id } }, date: new Date(date), easy: easyGrid, medium: mediumGrid, hard: hardGrid, easyComplete: easyCompleteFlag, mediumComplete: mediumCompleteFlag, hardComplete: hardCompleteFlag, easySeconds: easySecondsVal, mediumSeconds: mediumSecondsVal, hardSeconds: hardSecondsVal } });
    }
  }
  return Response.json(progress);
}
