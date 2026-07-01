import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getMSTDateString } from "@/app/nonogram/time";
import { ADMIN_EMAIL } from "@/lib/constants";

const SILVER_MIN_SOLVERS = 3;
const DIFFS = ["easy", "medium", "hard"] as const;

type Diff = typeof DIFFS[number];

const secField = (d: Diff) => `${d}Seconds` as "easySeconds" | "mediumSeconds" | "hardSeconds";
const complField = (d: Diff) => `${d}Complete` as "easyComplete" | "mediumComplete" | "hardComplete";
const goldField = (d: Diff) => `goldMedals${d.charAt(0).toUpperCase() + d.slice(1)}` as "goldMedalsEasy" | "goldMedalsMedium" | "goldMedalsHard";
const silverField = (d: Diff) => `silverMedals${d.charAt(0).toUpperCase() + d.slice(1)}` as "silverMedalsEasy" | "silverMedalsMedium" | "silverMedalsHard";

async function awardMedalsForDate(dateStr: string) {
  const date = new Date(dateStr);
  const nextDate = new Date(dateStr);
  nextDate.setDate(nextDate.getDate() + 1);

  const existing = await prisma.picrossMedal.count({
    where: { date: { gte: date, lt: nextDate } },
  });
  if (existing > 0) return { date: dateStr, skipped: true, gold: 0, silver: 0 };

  let totalGold = 0;
  let totalSilver = 0;

  for (const diff of DIFFS) {
    const solvers = await prisma.picrossProgress.findMany({
      where: {
        date: { gte: date, lt: nextDate },
        [complField(diff)]: true,
        [secField(diff)]: { gt: 0 },
      },
      select: { userId: true, [secField(diff)]: true },
    });

    if (solvers.length === 0) continue;

    const times = solvers.map((s) => ({
      userId: s.userId,
      seconds: (s as Record<string, unknown>)[secField(diff)] as number,
    }));

    const minTime = Math.min(...times.map((t) => t.seconds));
    const avg = times.reduce((sum, t) => sum + t.seconds, 0) / times.length;
    const goldWinners = times.filter((t) => t.seconds === minTime);
    const silverWinners =
      times.length >= SILVER_MIN_SOLVERS
        ? times.filter((t) => t.seconds < avg && t.seconds !== minTime)
        : [];

    const medalRows = [
      ...goldWinners.map((w) => ({ userId: w.userId, date, difficulty: diff, type: "gold", seconds: w.seconds })),
      ...silverWinners.map((w) => ({ userId: w.userId, date, difficulty: diff, type: "silver", seconds: w.seconds })),
    ];

    if (medalRows.length > 0) {
      await prisma.picrossMedal.createMany({ data: medalRows, skipDuplicates: true });
    }

    for (const w of goldWinners) {
      await prisma.picrossStats.upsert({
        where: { userId: w.userId },
        create: { userId: w.userId, [goldField(diff)]: 1 },
        update: { [goldField(diff)]: { increment: 1 } },
      });
    }
    for (const w of silverWinners) {
      await prisma.picrossStats.upsert({
        where: { userId: w.userId },
        create: { userId: w.userId, [silverField(diff)]: 1 },
        update: { [silverField(diff)]: { increment: 1 } },
      });
    }

    totalGold += goldWinners.length;
    totalSilver += silverWinners.length;
  }

  return { date: dateStr, skipped: false, gold: totalGold, silver: totalSilver };
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronOk = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!cronOk) {
    const session = await getServerSession(authOptions);
    if (session?.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const { searchParams } = new URL(req.url);
  const isBackfill = searchParams.get("backfill") === "true";

  if (isBackfill) {
    const today = new Date(getMSTDateString());
    const puzzles = await prisma.picrossPuzzle.findMany({
      where: { date: { lt: today } },
      select: { date: true },
      orderBy: { date: "asc" },
    });
    const results = [];
    for (const p of puzzles) {
      results.push(await awardMedalsForDate(p.date.toISOString().slice(0, 10)));
    }
    return Response.json({ backfill: true, processed: results.length, results });
  }

  const todayStr = getMSTDateString();
  const yesterday = new Date(todayStr);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateParam = searchParams.get("date") ?? yesterday.toISOString().slice(0, 10);
  return Response.json(await awardMedalsForDate(dateParam));
}
