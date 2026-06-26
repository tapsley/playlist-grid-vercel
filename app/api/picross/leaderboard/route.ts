import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

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

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const where = (diff: string) => ({
    type: "gold",
    difficulty: diff,
    date: { gte: monthStart, lt: monthEnd },
  });

  const [easyRows, mediumRows, hardRows, currentUser] = await Promise.all([
    prisma.picrossMedal.groupBy({ by: ["userId"], where: where("easy"),   _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
    prisma.picrossMedal.groupBy({ by: ["userId"], where: where("medium"), _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
    prisma.picrossMedal.groupBy({ by: ["userId"], where: where("hard"),   _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
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

  const monthLabel = monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return Response.json({
    easy:   buildRanked(easyRows,   currentUser?.id, userById),
    medium: buildRanked(mediumRows, currentUser?.id, userById),
    hard:   buildRanked(hardRows,   currentUser?.id, userById),
    month: monthLabel,
  });
}
