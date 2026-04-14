import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { getMSTDateString } from "@/app/nonogram/time";

const prisma = new PrismaClient();

function computeStreak(dates: Date[], todayStr: string): { current: number; max: number } {
  if (dates.length === 0) return { current: 0, max: 0 };
  const daySet = new Set(dates.map(d => d.toISOString().slice(0, 10)));
  const sorted = Array.from(daySet).sort();

  let maxStreak = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const a = new Date(sorted[i - 1]);
    const b = new Date(sorted[i]);
    const diffDays = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (diffDays === 1) {
      run++;
      if (run > maxStreak) maxStreak = run;
    } else {
      run = 1;
    }
  }

  const yesterdayDate = new Date(todayStr);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

  if (!daySet.has(todayStr) && !daySet.has(yesterdayStr)) {
    return { current: 0, max: maxStreak };
  }

  let checkStr = daySet.has(todayStr) ? todayStr : yesterdayStr;
  let current = 0;
  while (daySet.has(checkStr)) {
    current++;
    const d = new Date(checkStr);
    d.setDate(d.getDate() - 1);
    checkStr = d.toISOString().slice(0, 10);
  }

  return { current, max: maxStreak };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const todayStr = getMSTDateString();

  // Per-user solved counts and completion dates for streak computation
  const [easyDates, mediumDates, hardDates] = await Promise.all([
    prisma.picrossProgress.findMany({ where: { userId: session.user.id, easyComplete: true }, select: { date: true } }),
    prisma.picrossProgress.findMany({ where: { userId: session.user.id, mediumComplete: true }, select: { date: true } }),
    prisma.picrossProgress.findMany({ where: { userId: session.user.id, hardComplete: true }, select: { date: true } }),
  ]);

  const easy = easyDates.length;
  const medium = mediumDates.length;
  const hard = hardDates.length;

  const streaks = {
    easy: computeStreak(easyDates.map(d => d.date), todayStr),
    medium: computeStreak(mediumDates.map(d => d.date), todayStr),
    hard: computeStreak(hardDates.map(d => d.date), todayStr),
  };

  const statsRecord = await prisma.picrossStats.findUnique({ where: { userId: session.user.id } });
  const fastest = {
    easy: statsRecord?.fastestEasy ?? null,
    medium: statsRecord?.fastestMedium ?? null,
    hard: statsRecord?.fastestHard ?? null,
  };

  const base = { easy, medium, hard, fastest, streaks };

  // Admin/owner extra stats for Tyler
  const email = (session.user?.email || '').toString().toLowerCase();
  if (email === 'tyler.apsley@gmail.com') {
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
        select: { user: { select: { email: true } } },
      }),
    ]);

    const usersToday = solversToday.map(s => s.user.email);

    // per-date totals for the last 7 days (including today)
    const perDate: Array<{ date: string; easy: number; medium: number; hard: number; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.toISOString().slice(0, 10));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const [e, m, h] = await Promise.all([
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, easyComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, mediumComplete: true } }),
        prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, hardComplete: true } }),
      ]);
      perDate.push({ date: dayStart.toISOString().slice(0, 10), easy: e, medium: m, hard: h, total: e + m + h });
    }

    return new Response(JSON.stringify({
      ...base,
      admin: {
        today: { easy: easyToday, medium: mediumToday, hard: hardToday, total: easyToday + mediumToday + hardToday, users: usersToday },
        perDate,
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify(base), { status: 200, headers: { "Content-Type": "application/json" } });
}
