import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toPublicUrl(bucket: string, objectName: string) {
  const encoded = encodeURIComponent(objectName).replace(/%2F/g, "/");
  return `https://storage.googleapis.com/${bucket}/${encoded}`;
}

function toGameImageObjectName(gameName: string) {
  const prefix = (process.env.GAME_IMAGE_PREFIX ?? "games").trim().replace(/^\/+|\/+$/g, "");
  const ext = (process.env.GAME_IMAGE_EXT ?? "jpg").trim().replace(/^\./, "") || "jpg";
  return `${prefix}/${gameName.toLowerCase()}.${ext}`;
}

export async function GET() {
  const bucketName = process.env.GCS_BUCKET_NAME ?? "";

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

  const gameImages = items.map((name) => {
    const objectName = toGameImageObjectName(name);
    return {
      name,
      key: objectName,
      imageUrl: bucketName ? toPublicUrl(bucketName, objectName) : null,
    };
  });

  return NextResponse.json({ count: items.length, items, gameImages });
}
