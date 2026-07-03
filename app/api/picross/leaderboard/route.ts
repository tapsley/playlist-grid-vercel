import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getMSTDateString } from "@/app/nonogram/time";

const PRIORITY_EMAIL = 'summerapsley@gmail.com';

const EXCLUDED_EMAILS = new Set([
  'aa',
  'bb',
  'tyler.apsley@gmail.com'
  // Temporary: dummy/test accounts to hide from leaderboard
]);

type Entry = { rank: number; displayName: string; gold: number; isMe: boolean };

function buildRanked(
  rows: { userId: string; _count: { id: number } }[],
  currentUserId: string | undefined,
  userById: Map<string, { email: string }>,
): Entry[] {
  return rows.map((g, i) => ({
    rank: i + 1,
    displayName: (userById.get(g.userId)?.email ?? "").split("@")[0],
    gold: g._count.id,
    isMe: g.userId === currentUserId,
  }));
}

// GET /api/picross/leaderboard — current month's gold medal leaders per difficulty
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(_req.url);
  const qy = parseInt(searchParams.get('year') ?? '');
  const qm = parseInt(searchParams.get('month') ?? '');
  const [cy, cm] = getMSTDateString().split('-').map(Number);
  const y = qy || cy;
  const m = qm || cm;
  const monthStart = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00.000Z`);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const monthEnd = new Date(`${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00.000Z`);

  const where = (diff: string) => ({
    type: "gold",
    difficulty: diff,
    date: { gte: monthStart, lt: monthEnd },
  });

  const [easyRows, mediumRows, hardRows, currentUser] = await Promise.all([
    prisma.picrossMedal.groupBy({ by: ["userId"], where: where("easy"),   _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 20 }),
    prisma.picrossMedal.groupBy({ by: ["userId"], where: where("medium"), _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 20 }),
    prisma.picrossMedal.groupBy({ by: ["userId"], where: where("hard"),   _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 20 }),
    prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } }),
  ]);

  // Collect all userIds we need to display names for
  const allIds = new Set([
    ...easyRows, ...mediumRows, ...hardRows,
  ].map(g => g.userId));
  if (currentUser) allIds.add(currentUser.id);

  const users = await prisma.user.findMany({
    where: { id: { in: [...allIds] } },
    select: { id: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const monthLabel = new Date(`${y}-${String(m).padStart(2, '0')}-01T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "America/Denver" });

  const priorityUserId = [...userById.entries()].find(([, u]) => u.email === PRIORITY_EMAIL)?.[0];
  const exclude = (rows: typeof easyRows) => {
    const filtered = rows.filter(r => !EXCLUDED_EMAILS.has(userById.get(r.userId)?.email ?? ''));
    filtered.sort((a, b) => {
      if (b._count.id !== a._count.id) return b._count.id - a._count.id;
      if (a.userId === priorityUserId) return -1;
      if (b.userId === priorityUserId) return 1;
      return 0;
    });
    return filtered.slice(0, 5);
  };

  return Response.json({
    easy:   buildRanked(exclude(easyRows),   currentUser?.id, userById),
    medium: buildRanked(exclude(mediumRows), currentUser?.id, userById),
    hard:   buildRanked(exclude(hardRows), currentUser?.id, userById),
    month: monthLabel,
  });
}
