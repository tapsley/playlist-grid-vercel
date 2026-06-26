import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

type Status = "complete" | "in-progress" | "not-started";

function hasGridProgress(grid: unknown): boolean {
  if (!Array.isArray(grid)) return false;
  return (grid as unknown[][]).some(
    (row) => Array.isArray(row) && row.some((v: unknown) => Number(v) !== 0)
  );
}

function getDiffStatus(complete: boolean, grid: unknown): Status {
  if (complete) return "complete";
  if (hasGridProgress(grid)) return "in-progress";
  return "not-started";
}

// GET /api/picross/calendar?year=YYYY&month=M
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? "", 10);
  const month = parseInt(searchParams.get("month") ?? "", 10); // 1-based
  if (!year || !month || month < 1 || month > 12) {
    return new Response("Invalid year/month", { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const [puzzleRows, progressRows, medalRows] = await Promise.all([
    prisma.picrossPuzzle.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      select: { date: true, easy: true, medium: true, hard: true },
    }),
    prisma.picrossProgress.findMany({
      where: { userId: session.user.id, date: { gte: monthStart, lt: monthEnd } },
      select: {
        date: true,
        easy: true, easyComplete: true,
        medium: true, mediumComplete: true,
        hard: true, hardComplete: true,
      },
    }),
    prisma.picrossMedal.findMany({
      where: { userId: session.user.id, date: { gte: monthStart, lt: monthEnd } },
      select: { date: true, difficulty: true, type: true },
    }),
  ]);

  const puzzleDates = new Set(puzzleRows.map((p) => p.date.toISOString().slice(0, 10)));
  const puzzleGridByDate = new Map(
    puzzleRows.map((p) => [p.date.toISOString().slice(0, 10), { easy: p.easy, medium: p.medium, hard: p.hard }])
  );
  const progressByDate = new Map(
    progressRows.map((p) => [p.date.toISOString().slice(0, 10), p])
  );

  // Build medals map: date → { easy, medium, hard }
  const medalsByDate = new Map<string, { easy: string | null; medium: string | null; hard: string | null }>();
  for (const m of medalRows) {
    const d = m.date.toISOString().slice(0, 10);
    if (!medalsByDate.has(d)) medalsByDate.set(d, { easy: null, medium: null, hard: null });
    const entry = medalsByDate.get(d)!;
    entry[m.difficulty as "easy" | "medium" | "hard"] = m.type;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const puz = puzzleGridByDate.get(dateStr);
    const prog = progressByDate.get(dateStr);
    const dayMedals = medalsByDate.get(dateStr) ?? { easy: null, medium: null, hard: null };
    days.push({
      date: dateStr,
      puzzleExists: puzzleDates.has(dateStr),
      easy:   getDiffStatus(prog?.easyComplete   ?? false, prog?.easy),
      medium: getDiffStatus(prog?.mediumComplete ?? false, prog?.medium),
      hard:   getDiffStatus(prog?.hardComplete   ?? false, prog?.hard),
      easyGrid:   puz?.easy   ?? null,
      mediumGrid: puz?.medium ?? null,
      hardGrid:   puz?.hard   ?? null,
      easyProgress:   prog?.easy   ?? null,
      mediumProgress: prog?.medium ?? null,
      hardProgress:   prog?.hard   ?? null,
      medals: dayMedals,
    });
  }

  return Response.json({ days });
}
