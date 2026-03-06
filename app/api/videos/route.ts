import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function toIntOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;

  // Prisma Int = 32-bit signed
  const maxInt = 2147483647;
  if (n > maxInt) return null;

  return Math.trunc(n);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const game = (searchParams.get("game") ?? "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 25), 1), 100);

  const where: Prisma.VideoWhereInput = game
    ? { game: { contains: game, mode: "insensitive" } }
    : {};

  const items = await prisma.video.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ count: items.length, items });
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const upsert = searchParams.get("upsert") === "true";

    const body = await req.json();

    // Accept both old/new key names to be resilient
    const name = String(body.name ?? body.title ?? "").trim();
    const game = String(body.game ?? "").trim() || null;
    const gcsPath = String(body.gcsPath ?? body.objectName ?? "").trim();
    const url = String(body.url ?? body.publicUrl ?? "").trim();
    const contentType = body.contentType ? String(body.contentType).trim() : null;
    const size = toIntOrNull(body.size ?? body.sizeBytes);
    const updatedAt = body.updatedAt ? new Date(body.updatedAt) : null;

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!gcsPath) return NextResponse.json({ error: "gcsPath is required" }, { status: 400 });
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "url must be valid" }, { status: 400 });
    }

    const data = {
      name,
      game,
      gcsPath,
      url: parsedUrl.toString(),
      contentType,
      size,
      updatedAt,
    };

    const video = upsert
      ? await prisma.video.upsert({
          where: { gcsPath },
          create: data,
          update: data,
        })
      : await prisma.video.create({ data });

    return NextResponse.json(video, { status: upsert ? 200 : 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Video already exists for this gcsPath. Use ?upsert=true." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to save video" }, { status: 500 });
  }
}