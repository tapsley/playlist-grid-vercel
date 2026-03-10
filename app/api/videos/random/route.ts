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
  const tags = parseTags(searchParams.get("tags") ?? "");

  const where: Prisma.VideoWhereInput = {
    AND: [
      game ? { game: { contains: game, mode: "insensitive" } } : {},
      tags.length ? { tags: { hasSome: tags } } : {},
    ],
  };

  const count = await prisma.video.count({ where });

  if (count === 0) {
    return NextResponse.json({ error: "No matching videos found" }, { status: 404 });
  }

  const randomIndex = Math.floor(Math.random() * count);
  const [item] = await prisma.video.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: randomIndex,
    take: 1,
  });

  return NextResponse.json({ item });
}
