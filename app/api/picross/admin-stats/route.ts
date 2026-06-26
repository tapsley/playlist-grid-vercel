import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getMSTDateString } from "@/app/nonogram/time";
import { ADMIN_EMAIL } from "@/lib/constants";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return new Response("Unauthorized", { status: 401 });
  if (session.user.email.toLowerCase() !== ADMIN_EMAIL) return new Response("Forbidden", { status: 403 });

  const todayStr = getMSTDateString();
  const start = new Date(todayStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const monthStart = new Date(todayStr.slice(0, 7) + '-01');

  const [easyToday, mediumToday, hardToday, pastEasyToday, pastMediumToday, pastHardToday, solversToday, monthlyUniqueSolvers] = await Promise.all([
    prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, easyComplete: true } }),
    prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, mediumComplete: true } }),
    prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, hardComplete: true } }),
    prisma.picrossProgress.count({ where: { date: { lt: start }, updatedAt: { gte: start, lt: end }, easyComplete: true } }),
    prisma.picrossProgress.count({ where: { date: { lt: start }, updatedAt: { gte: start, lt: end }, mediumComplete: true } }),
    prisma.picrossProgress.count({ where: { date: { lt: start }, updatedAt: { gte: start, lt: end }, hardComplete: true } }),
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

  const roundAvg = (v: number | null | undefined) => v != null ? Math.round(v) : null;
  const perDate = await Promise.all(
    Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(start);
      d.setDate(d.getDate() - (6 - idx));
      const dayStart = new Date(d.toISOString().slice(0, 10));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      return Promise.all([
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, easyComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, mediumComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, hardComplete: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, easyComplete: true, easySeconds: { gt: 0 } }, _avg: { easySeconds: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, mediumComplete: true, mediumSeconds: { gt: 0 } }, _avg: { mediumSeconds: true } }),
        prisma.picrossProgress.aggregate({ where: { date: { gte: dayStart, lt: dayEnd }, hardComplete: true, hardSeconds: { gt: 0 } }, _avg: { hardSeconds: true } }),
      ]).then(([e, m, h, eAvg, mAvg, hAvg]) => ({
        date: dayStart.toISOString().slice(0, 10),
        easy: e, medium: m, hard: h, total: e + m + h,
        avgEasy: roundAvg(eAvg._avg.easySeconds),
        avgMedium: roundAvg(mAvg._avg.mediumSeconds),
        avgHard: roundAvg(hAvg._avg.hardSeconds),
      }));
    })
  );

  return Response.json({
    today: {
      easy: easyToday, medium: mediumToday, hard: hardToday,
      total: easyToday + mediumToday + hardToday,
      pastSolves: { easy: pastEasyToday, medium: pastMediumToday, hard: pastHardToday },
      users: usersToday,
    },
    monthlyUniqueUsers: monthlyUniqueSolvers.length,
    newUsersThisMonth,
    perDate,
  });
}
