import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getMSTDateString } from "@/app/nonogram/time";
import { ADMIN_EMAIL } from "@/lib/constants";

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
  const baseWithAvg = { ...base, todayAvg, todayDistribution, myTodaySeconds };
  const email = (session.user?.email || '').toString().toLowerCase();
  if (email === ADMIN_EMAIL) {
    const start = new Date(todayStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const monthStart = new Date(todayStr.slice(0, 7) + '-01');
    const [easyToday, mediumToday, hardToday, solversToday, monthlyUniqueSolvers] = await Promise.all([
      prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, easyComplete: true } }),
      prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, mediumComplete: true } }),
      prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, hardComplete: true } }),
      prisma.picrossProgress.findMany({
        where: {
          date: { gte: start, lt: end },
          OR: [{ easyComplete: true }, { mediumComplete: true }, { hardComplete: true }],
        },
        select: {
          user: { select: { email: true } },
          easyComplete: true, easySeconds: true,
          mediumComplete: true, mediumSeconds: true,
          hardComplete: true, hardSeconds: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.picrossProgress.findMany({
        where: {
          date: { gte: monthStart },
          OR: [{ easyComplete: true }, { mediumComplete: true }, { hardComplete: true }],
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const monthlyUserIds = monthlyUniqueSolvers.map(s => s.userId);
    const priorSolvers = monthlyUserIds.length > 0
      ? await prisma.picrossProgress.findMany({
          where: {
            userId: { in: monthlyUserIds },
            date: { lt: monthStart },
            OR: [{ easyComplete: true }, { mediumComplete: true }, { hardComplete: true }],
          },
          select: { userId: true },
          distinct: ['userId'],
        })
      : [];
    const priorSolverIds = new Set(priorSolvers.map(s => s.userId));
    const newUsersThisMonth = monthlyUserIds.filter(id => !priorSolverIds.has(id)).length;

    const usersToday = solversToday.map(s => ({
      email: s.user.email,
      easy:   s.easyComplete   ? (s.easySeconds   > 0 ? s.easySeconds   : null) : null,
      medium: s.mediumComplete ? (s.mediumSeconds > 0 ? s.mediumSeconds : null) : null,
      hard:   s.hardComplete   ? (s.hardSeconds   > 0 ? s.hardSeconds   : null) : null,
      updatedAt: s.updatedAt.toISOString(),
    }));

    // per-date totals + average solve times for the last 7 days (including today)
    const perDate: Array<{ date: string; easy: number; medium: number; hard: number; total: number; avgEasy: number | null; avgMedium: number | null; avgHard: number | null }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.toISOString().slice(0, 10));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const [e, m, h, eAvg, mAvg, hAvg] = await Promise.all([
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, easyComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, mediumComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, hardComplete: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, easyComplete: true, easySeconds: { gt: 0 } }, _avg: { easySeconds: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, mediumComplete: true, mediumSeconds: { gt: 0 } }, _avg: { mediumSeconds: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, hardComplete: true, hardSeconds: { gt: 0 } }, _avg: { hardSeconds: true } }),
      ]);
      const roundAvg = (v: number | null | undefined) => v != null ? Math.round(v) : null;
      perDate.push({
        date: dayStart.toISOString().slice(0, 10),
        easy: e, medium: m, hard: h, total: e + m + h,
        avgEasy: roundAvg(eAvg._avg.easySeconds),
        avgMedium: roundAvg(mAvg._avg.mediumSeconds),
        avgHard: roundAvg(hAvg._avg.hardSeconds),
      });
    }

    return new Response(JSON.stringify({
      ...baseWithAvg,
      admin: {
        today: { easy: easyToday, medium: mediumToday, hard: hardToday, total: easyToday + mediumToday + hardToday, users: usersToday },
        monthlyUniqueUsers: monthlyUniqueSolvers.length,
        newUsersThisMonth,
        perDate,
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify(baseWithAvg), { status: 200, headers: { "Content-Type": "application/json" } });
}
