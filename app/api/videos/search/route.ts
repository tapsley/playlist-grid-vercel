import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => String(v).trim().toLowerCase()).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [...new Set(value.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean))];
  }

  return [];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const game = (searchParams.get("game") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();
  const tags = parseTags(searchParams.get("tags") ?? "");
  const normalizedQ = q.toLowerCase();
  const groupByGame = searchParams.get("groupByGame") === "true";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 25), 1), 100);

  const where: Prisma.VideoWhereInput = {
    AND: [
      game ? { game: { contains: game, mode: "insensitive" } } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { gcsPath: { contains: q, mode: "insensitive" } },
              { game: { contains: q, mode: "insensitive" } },
              ...(normalizedQ ? [{ tags: { has: normalizedQ } }] : []),
            ],
          }
        : {},
      tags.length ? { tags: { hasSome: tags } } : {},
    ],
  };

  const items = await prisma.video.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  if (!groupByGame) {
    return NextResponse.json({ count: items.length, items });
  }

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    const key = item.game?.trim() || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return NextResponse.json({
    count: items.length,
    groupedCount: Object.keys(grouped).length,
    grouped,
  });
}