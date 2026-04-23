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

  const [statsRecord, easy, medium, hard] = await Promise.all([
    prisma.picrossStats.findUnique({ where: { userId: session.user.id } }),
    prisma.picrossProgress.count({ where: { userId: session.user.id, easyComplete: true } }),
    prisma.picrossProgress.count({ where: { userId: session.user.id, mediumComplete: true } }),
    prisma.picrossProgress.count({ where: { userId: session.user.id, hardComplete: true } }),
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

  const base = { easy, medium, hard, fastest, streaks };

  // Today's average solve times — included for all users (used for completion message)
  const todayStart = new Date(todayStr);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const [eAvgToday, mAvgToday, hAvgToday, eCountToday, mCountToday, hCountToday] = await Promise.all([
    prisma.picrossProgress.aggregate({ where: { date: { gte: todayStart, lt: todayEnd }, easyComplete: true, easySeconds: { gt: 0 } }, _avg: { easySeconds: true } }),
    prisma.picrossProgress.aggregate({ where: { date: { gte: todayStart, lt: todayEnd }, mediumComplete: true, mediumSeconds: { gt: 0 } }, _avg: { mediumSeconds: true } }),
    prisma.picrossProgress.aggregate({ where: { date: { gte: todayStart, lt: todayEnd }, hardComplete: true, hardSeconds: { gt: 0 } }, _avg: { hardSeconds: true } }),
    prisma.picrossProgress.count({ where: { date: { gte: todayStart, lt: todayEnd }, easyComplete: true, easySeconds: { gt: 0 } } }),
    prisma.picrossProgress.count({ where: { date: { gte: todayStart, lt: todayEnd }, mediumComplete: true, mediumSeconds: { gt: 0 } } }),
    prisma.picrossProgress.count({ where: { date: { gte: todayStart, lt: todayEnd }, hardComplete: true, hardSeconds: { gt: 0 } } }),
  ]);
  const roundAvgBase = (v: number | null | undefined) => v != null ? Math.round(v) : null;
  const todayAvg = {
    easy:   { avg: roundAvgBase(eAvgToday._avg.easySeconds),   count: eCountToday },
    medium: { avg: roundAvgBase(mAvgToday._avg.mediumSeconds), count: mCountToday },
    hard:   { avg: roundAvgBase(hAvgToday._avg.hardSeconds),   count: hCountToday },
  };
  const baseWithAvg = { ...base, todayAvg };
  const email = (session.user?.email || '').toString().toLowerCase();
  if (email === ADMIN_EMAIL) {
    const start = new Date(todayStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [easyToday, mediumToday, hardToday, solversToday] = await Promise.all([
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
        },
      }),
    ]);

    const usersToday = solversToday.map(s => ({
      email: s.user.email,
      easy:   s.easyComplete   ? (s.easySeconds   > 0 ? s.easySeconds   : null) : null,
      medium: s.mediumComplete ? (s.mediumSeconds > 0 ? s.mediumSeconds : null) : null,
      hard:   s.hardComplete   ? (s.hardSeconds   > 0 ? s.hardSeconds   : null) : null,
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
        perDate,
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify(baseWithAvg), { status: 200, headers: { "Content-Type": "application/json" } });
}
