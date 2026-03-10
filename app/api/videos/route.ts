import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const THUMBNAIL_STATUSES = ["pending", "ready", "failed"] as const;
type ThumbnailStatus = (typeof THUMBNAIL_STATUSES)[number];

function parseThumbnailStatus(value: unknown): ThumbnailStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return THUMBNAIL_STATUSES.includes(normalized as ThumbnailStatus)
    ? (normalized as ThumbnailStatus)
    : null;
}

function toIntOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;

  // Prisma Int = 32-bit signed
  const maxInt = 2147483647;
  if (n > maxInt) return null;

  return Math.trunc(n);
}

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
  const rawTags = (searchParams.get("tags") ?? "").trim();
  const tags = parseTags(rawTags);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 250), 1), 1000);

  const where: Prisma.VideoWhereInput = {
    AND: [
      game ? { game: { contains: game, mode: "insensitive" } } : {},
      tags.length ? { tags: { hasSome: tags } } : {},
    ],
  };

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
    const title = body.title ? String(body.title).trim() : null;
    const description = body.description ? String(body.description).trim() : null;
    const tags = parseTags(body.tags);
    const game = String(body.game ?? "").trim() || null;
    const gcsPath = String(body.gcsPath ?? body.objectName ?? "").trim();
    const url = String(body.url ?? body.publicUrl ?? "").trim();
    const contentType = body.contentType ? String(body.contentType).trim() : null;
    const size = toIntOrNull(body.size ?? body.sizeBytes);
    const updatedAt = body.updatedAt ? new Date(body.updatedAt) : null;
    const thumbnailKey = body.thumbnailKey ? String(body.thumbnailKey).trim() : null;
    const thumbnailUrlRaw = body.thumbnailUrl ? String(body.thumbnailUrl).trim() : null;
    const thumbnailStatus = parseThumbnailStatus(body.thumbnailStatus) ?? "pending";
    const thumbnailGeneratedAt = body.thumbnailGeneratedAt ? new Date(body.thumbnailGeneratedAt) : null;
    const thumbnailError = body.thumbnailError ? String(body.thumbnailError).trim() : null;

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!gcsPath) return NextResponse.json({ error: "gcsPath is required" }, { status: 400 });
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "url must be valid" }, { status: 400 });
    }

    let parsedThumbnailUrl: URL | null = null;
    if (thumbnailUrlRaw) {
      try {
        parsedThumbnailUrl = new URL(thumbnailUrlRaw);
      } catch {
        return NextResponse.json({ error: "thumbnailUrl must be valid" }, { status: 400 });
      }
    }

    const data = {
      name,
      title,
      description,
      tags,
      game,
      gcsPath,
      url: parsedUrl.toString(),
      contentType,
      size,
      updatedAt,
      thumbnailKey,
      thumbnailUrl: parsedThumbnailUrl?.toString() ?? null,
      thumbnailStatus,
      thumbnailGeneratedAt,
      thumbnailError,
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

export async function PATCH(req: Request) {
  try {
    const body = await req.json();

    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const description =
      body.description == null ? null : String(body.description).trim() || null;
    const game = body.game == null ? null : String(body.game).trim() || null;
    const title = body.title == null ? null : String(body.title).trim() || null;
    const tags = parseTags(body.tags);
    const thumbnailKey = body.thumbnailKey == null ? undefined : String(body.thumbnailKey).trim() || null;
    const thumbnailUrlRaw =
      body.thumbnailUrl == null ? undefined : String(body.thumbnailUrl).trim() || null;
    const thumbnailStatus =
      body.thumbnailStatus == null ? undefined : parseThumbnailStatus(body.thumbnailStatus);
    const thumbnailGeneratedAt =
      body.thumbnailGeneratedAt == null
        ? undefined
        : body.thumbnailGeneratedAt
          ? new Date(body.thumbnailGeneratedAt)
          : null;
    const thumbnailError =
      body.thumbnailError == null ? undefined : String(body.thumbnailError).trim() || null;

    if (body.thumbnailStatus != null && !thumbnailStatus) {
      return NextResponse.json(
        { error: "thumbnailStatus must be one of: pending, ready, failed" },
        { status: 400 }
      );
    }

    let thumbnailUrl: string | null | undefined = undefined;
    if (thumbnailUrlRaw !== undefined) {
      if (thumbnailUrlRaw === null) {
        thumbnailUrl = null;
      } else {
        try {
          thumbnailUrl = new URL(thumbnailUrlRaw).toString();
        } catch {
          return NextResponse.json({ error: "thumbnailUrl must be valid" }, { status: 400 });
        }
      }
    }

    const video = await prisma.video.update({
      where: { id },
      data: {
        game,
        title,
        description,
        tags,
        thumbnailKey,
        thumbnailUrl,
        thumbnailStatus: thumbnailStatus ?? undefined,
        thumbnailGeneratedAt,
        thumbnailError,
      },
    });

    return NextResponse.json(video);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}