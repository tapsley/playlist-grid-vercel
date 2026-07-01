import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getMSTDateString } from "@/app/nonogram/time";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const todayStr = getMSTDateString();
  const yest = new Date(todayStr);
  yest.setDate(yest.getDate() - 1);
  const yesterStr = yest.toISOString().slice(0, 10);

  function getDisplayStreak(lastSolved: Date | null | undefined, currentStreak: number): number {
    if (!lastSolved) return 0;
    const lastStr = lastSolved.toISOString().slice(0, 10);
    return (lastStr === todayStr || lastStr === yesterStr) ? currentStreak : 0;
  }

  const yesterdayStart = new Date(yesterStr);
  const yesterdayEnd = new Date(yesterStr);
  yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

  const [statsRecord, easy, medium, hard, yesterdayMedals] = await Promise.all([
    prisma.picrossStats.findUnique({ where: { userId: session.user.id } }),
    prisma.picrossProgress.count({ where: { userId: session.user.id, easyComplete: true } }),
    prisma.picrossProgress.count({ where: { userId: session.user.id, mediumComplete: true } }),
    prisma.picrossProgress.count({ where: { userId: session.user.id, hardComplete: true } }),
    prisma.picrossMedal.findMany({
      where: { userId: session.user.id, date: { gte: yesterdayStart, lt: yesterdayEnd } },
      select: { difficulty: true, type: true },
    }),
  ]);

  const fastest = {
    easy: statsRecord?.fastestEasy ?? null,
    medium: statsRecord?.fastestMedium ?? null,
    hard: statsRecord?.fastestHard ?? null,
  };

  const streaks = {
    easy: {
      current: getDisplayStreak(statsRecord?.lastSolvedEasy, statsRecord?.currentStreakEasy ?? 0),
      max: statsRecord?.maxStreakEasy ?? 0,
    },
    medium: {
      current: getDisplayStreak(statsRecord?.lastSolvedMedium, statsRecord?.currentStreakMedium ?? 0),
      max: statsRecord?.maxStreakMedium ?? 0,
    },
    hard: {
      current: getDisplayStreak(statsRecord?.lastSolvedHard, statsRecord?.currentStreakHard ?? 0),
      max: statsRecord?.maxStreakHard ?? 0,
    },
  };

  const medals = {
    goldEasy:     statsRecord?.goldMedalsEasy     ?? 0,
    goldMedium:   statsRecord?.goldMedalsMedium   ?? 0,
    goldHard:     statsRecord?.goldMedalsHard     ?? 0,
    silverEasy:   statsRecord?.silverMedalsEasy   ?? 0,
    silverMedium: statsRecord?.silverMedalsMedium ?? 0,
    silverHard:   statsRecord?.silverMedalsHard   ?? 0,
  };

  const base = { easy, medium, hard, fastest, streaks, medals, yesterdayMedals };

  // Today's average solve times — included for all users (used for completion message)
  const todayStart = new Date(todayStr);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const [eAvgToday, mAvgToday, hAvgToday, eCountToday, mCountToday, hCountToday, allTodayProgress, myTodayProgress] = await Promise.all([
    prisma.picrossProgress.aggregate({ where: { date: { gte: todayStart, lt: todayEnd }, easyComplete: true, easySeconds: { gt: 0 } }, _avg: { easySeconds: true } }),
    prisma.picrossProgress.aggregate({ where: { date: { gte: todayStart, lt: todayEnd }, mediumComplete: true, mediumSeconds: { gt: 0 } }, _avg: { mediumSeconds: true } }),
    prisma.picrossProgress.aggregate({ where: { date: { gte: todayStart, lt: todayEnd }, hardComplete: true, hardSeconds: { gt: 0 } }, _avg: { hardSeconds: true } }),
    prisma.picrossProgress.count({ where: { date: { gte: todayStart, lt: todayEnd }, easyComplete: true, easySeconds: { gt: 0 } } }),
    prisma.picrossProgress.count({ where: { date: { gte: todayStart, lt: todayEnd }, mediumComplete: true, mediumSeconds: { gt: 0 } } }),
    prisma.picrossProgress.count({ where: { date: { gte: todayStart, lt: todayEnd }, hardComplete: true, hardSeconds: { gt: 0 } } }),
    prisma.picrossProgress.findMany({
      where: { date: { gte: todayStart, lt: todayEnd }, OR: [{ easyComplete: true }, { mediumComplete: true }, { hardComplete: true }] },
      select: { easyComplete: true, easySeconds: true, mediumComplete: true, mediumSeconds: true, hardComplete: true, hardSeconds: true },
    }),
    prisma.picrossProgress.findFirst({
      where: { userId: session.user.id, date: { gte: todayStart, lt: todayEnd } },
      select: { easyComplete: true, easySeconds: true, mediumComplete: true, mediumSeconds: true, hardComplete: true, hardSeconds: true },
    }),
  ]);
  const roundAvgBase = (v: number | null | undefined) => v != null ? Math.round(v) : null;
  const todayAvg = {
    easy:   { avg: roundAvgBase(eAvgToday._avg.easySeconds),   count: eCountToday },
    medium: { avg: roundAvgBase(mAvgToday._avg.mediumSeconds), count: mCountToday },
    hard:   { avg: roundAvgBase(hAvgToday._avg.hardSeconds),   count: hCountToday },
  };
  const todayDistribution = {
    easy:   allTodayProgress.filter(p => p.easyComplete   && p.easySeconds   > 0).map(p => p.easySeconds),
    medium: allTodayProgress.filter(p => p.mediumComplete && p.mediumSeconds > 0).map(p => p.mediumSeconds),
    hard:   allTodayProgress.filter(p => p.hardComplete   && p.hardSeconds   > 0).map(p => p.hardSeconds),
  };
  const myTodaySeconds = {
    easy:   myTodayProgress?.easyComplete   && myTodayProgress.easySeconds   > 0 ? myTodayProgress.easySeconds   : null,
    medium: myTodayProgress?.mediumComplete && myTodayProgress.mediumSeconds > 0 ? myTodayProgress.mediumSeconds : null,
    hard:   myTodayProgress?.hardComplete   && myTodayProgress.hardSeconds   > 0 ? myTodayProgress.hardSeconds   : null,
  };

  return new Response(JSON.stringify({ ...base, todayAvg, todayDistribution, myTodaySeconds }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
