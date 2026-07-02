import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getMSTDateString, getMSTMidnight } from "@/app/nonogram/time";
import { ADMIN_EMAIL } from "@/lib/constants";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });
  if (session.user.email.toLowerCase() !== ADMIN_EMAIL) return new Response("Forbidden", { status: 403 });

  const todayStr = getMSTDateString();
  const start = new Date(todayStr);         // UTC midnight — used for puzzle `date` field comparisons
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const mstStart = getMSTMidnight(todayStr); // MST midnight — used for `updatedAt` comparisons
  const mstEnd = new Date(mstStart.getTime() + 86400 * 1000);
  const monthStart = new Date(todayStr.slice(0, 7) + '-01');

  const [easyToday, mediumToday, hardToday, pastSolversRaw, solversToday, monthlyUniqueSolvers] = await Promise.all([
    prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, easyComplete: true } }),
    prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, mediumComplete: true } }),
    prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, hardComplete: true } }),
    prisma.picrossProgress.findMany({
      where: {
        date: { lt: start },
        updatedAt: { gte: mstStart, lt: mstEnd },
        OR: [{ easyComplete: true }, { mediumComplete: true }, { hardComplete: true }],
      },
      select: {
        user: { select: { email: true } },
        easyComplete: true,
        mediumComplete: true,
        hardComplete: true,
      },
      orderBy: { updatedAt: 'asc' },
    }),
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

  const pastUserMap = new Map<string, { email: string; easy: number; medium: number; hard: number }>();
  for (const row of pastSolversRaw) {
    const email = row.user.email;
    if (!pastUserMap.has(email)) pastUserMap.set(email, { email, easy: 0, medium: 0, hard: 0 });
    const u = pastUserMap.get(email)!;
    if (row.easyComplete) u.easy++;
    if (row.mediumComplete) u.medium++;
    if (row.hardComplete) u.hard++;
  }
  const pastUsers = [...pastUserMap.values()];
  const pastSolves = {
    easy: pastUsers.reduce((s, u) => s + u.easy, 0),
    medium: pastUsers.reduce((s, u) => s + u.medium, 0),
    hard: pastUsers.reduce((s, u) => s + u.hard, 0),
  };

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

  const roundAvg = (v: number | null | undefined) => v != null ? Math.round(v) : null;
  const perDate = await Promise.all(
    Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(start);
      d.setDate(d.getDate() - (6 - idx));
      const dayStr = d.toISOString().slice(0, 10);
      const dayStart = new Date(dayStr);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayMstStart = getMSTMidnight(dayStr);
      const dayMstEnd = new Date(dayMstStart.getTime() + 86400 * 1000);
      return Promise.all([
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, easyComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, mediumComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, hardComplete: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, easyComplete: true, easySeconds: { gt: 0 } }, _avg: { easySeconds: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, mediumComplete: true, mediumSeconds: { gt: 0 } }, _avg: { mediumSeconds: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, hardComplete: true, hardSeconds: { gt: 0 } }, _avg: { hardSeconds: true } }),
        prisma.picrossProgress.count({ where: { date: { lt: dayStart }, updatedAt: { gte: dayMstStart, lt: dayMstEnd }, easyComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { lt: dayStart }, updatedAt: { gte: dayMstStart, lt: dayMstEnd }, mediumComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { lt: dayStart }, updatedAt: { gte: dayMstStart, lt: dayMstEnd }, hardComplete: true } }),
      ]).then(([e, m, h, eAvg, mAvg, hAvg, pe, pm, ph]) => ({
        date: dayStr,
        easy: e, medium: m, hard: h, total: e + m + h,
        avgEasy: roundAvg(eAvg._avg.easySeconds),
        avgMedium: roundAvg(mAvg._avg.mediumSeconds),
        avgHard: roundAvg(hAvg._avg.hardSeconds),
        pastEasy: pe, pastMedium: pm, pastHard: ph, pastTotal: pe + pm + ph,
      }));
    })
  );

  return Response.json({
    today: {
      easy: easyToday, medium: mediumToday, hard: hardToday,
      total: easyToday + mediumToday + hardToday,
      pastSolves,
      pastUsers,
      users: usersToday,
    },
    monthlyUniqueUsers: monthlyUniqueSolvers.length,
    newUsersThisMonth,
    perDate,
  });
}
