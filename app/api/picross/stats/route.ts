import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  // Normal per-user totals (all time)
  const easy = await prisma.picrossProgress.count({ where: { userId: session.user.id, easyComplete: true } });
  const medium = await prisma.picrossProgress.count({ where: { userId: session.user.id, mediumComplete: true } });
  const hard = await prisma.picrossProgress.count({ where: { userId: session.user.id, hardComplete: true } });

  const statsRecord = await prisma.picrossStats.findUnique({ where: { userId: session.user.id } });
  const fastest = {
    easy: statsRecord?.fastestEasy ?? null,
    medium: statsRecord?.fastestMedium ?? null,
    hard: statsRecord?.fastestHard ?? null,
  };
  const solvedFromStats = {
    easy: statsRecord?.solvedEasy ?? null,
    medium: statsRecord?.solvedMedium ?? null,
    hard: statsRecord?.solvedHard ?? null,
  };

  const base = { easy, medium, hard, fastest, solvedFromStats };

  // Admin/owner extra stats for Tyler
  const email = (session.user?.email || '').toString().toLowerCase();
  if (email === 'tyler.apsley@gmail.com') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const start = new Date(todayStr);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const easyToday = await prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, easyComplete: true } });
    const mediumToday = await prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, mediumComplete: true } });
    const hardToday = await prisma.picrossProgress.count({ where: { date: { gte: start, lt: end }, hardComplete: true } });

    // all-time totals across all users
    const easyAll = await prisma.picrossProgress.count({ where: { easyComplete: true } });
    const mediumAll = await prisma.picrossProgress.count({ where: { mediumComplete: true } });
    const hardAll = await prisma.picrossProgress.count({ where: { hardComplete: true } });

    // per-date totals for the last 7 days (including today)
    const perDate: Array<{ date: string; easy: number; medium: number; hard: number; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(start);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.toISOString().slice(0, 10));
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const e = await prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, easyComplete: true } });
      const m = await prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, mediumComplete: true } });
      const h = await prisma.picrossProgress.count({ where: { date: { gte: dayStart, lt: dayEnd }, hardComplete: true } });
      perDate.push({ date: dayStart.toISOString().slice(0, 10), easy: e, medium: m, hard: h, total: e + m + h });
    }

    return new Response(JSON.stringify({
      ...base,
      admin: {
        today: { easy: easyToday, medium: mediumToday, hard: hardToday, total: easyToday + mediumToday + hardToday },
        perDate,
        allTime: { easy: easyAll, medium: mediumAll, hard: hardAll, total: easyAll + mediumAll + hardAll }
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify(base), { status: 200, headers: { "Content-Type": "application/json" } });
}
