import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const grouped = await prisma.video.groupBy({
    by: ["game"],
    where: {
      game: {
        not: null,
      },
    },
    orderBy: {
      game: "asc",
    },
  });

  const items = grouped
    .map((entry) => entry.game?.trim() ?? "")
    .filter((game) => game.length > 0);

  return NextResponse.json({ count: items.length, items });
}
