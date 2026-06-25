import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { ADMIN_EMAIL } from "@/lib/constants";

// GET /api/picross/day-stats?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Response("Invalid date", { status: 400 });
  }

  const date = new Date(dateStr);
  const nextDate = new Date(dateStr);
  nextDate.setDate(nextDate.getDate() + 1);

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  });

  const [progress, medals] = await Promise.all([
    prisma.picrossProgress.findMany({
      where: { date: { gte: date, lt: nextDate } },
      select: {
        userId: true,
        easyComplete: true, easySeconds: true,
        mediumComplete: true, mediumSeconds: true,
        hardComplete: true, hardSeconds: true,
      },
    }),
    prisma.picrossMedal.findMany({
      where: { date: { gte: date, lt: nextDate } },
      include: { user: { select: { email: true } } },
    }),
  ]);

  const buildDiff = (complete: "easyComplete" | "mediumComplete" | "hardComplete", seconds: "easySeconds" | "mediumSeconds" | "hardSeconds") => {
    const completed = progress.filter((p) => p[complete] && p[seconds] > 0);
    const times = completed.map((p) => p[seconds]);
    const count = times.length;
    const avg = count > 0 ? Math.round(times.reduce((s, t) => s + t, 0) / count) : null;
    const fastest = count > 0 ? Math.min(...times) : null;
    const myRecord = currentUser ? completed.find((p) => p.userId === currentUser.id) : null;
    const myTime = myRecord ? myRecord[seconds] : null;
    return { count, avg, fastest, times, myTime };
  };

  const medalsByDiff = (diff: string) => {
    const gold = medals.filter((m) => m.difficulty === diff && m.type === "gold");
    const silver = medals.filter((m) => m.difficulty === diff && m.type === "silver");
    return {
      gold: gold.length > 0 ? { seconds: gold[0].seconds, emails: gold.map((m) => m.user.email) } : null,
      silver: silver.length > 0 ? { seconds: silver[0].seconds, count: silver.length } : null,
    };
  };

  return Response.json({
    date: dateStr,
    easy:   { ...buildDiff("easyComplete",   "easySeconds"),   medals: medalsByDiff("easy") },
    medium: { ...buildDiff("mediumComplete", "mediumSeconds"), medals: medalsByDiff("medium") },
    hard:   { ...buildDiff("hardComplete",   "hardSeconds"),   medals: medalsByDiff("hard") },
  });
}
