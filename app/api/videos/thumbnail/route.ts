import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const THUMBNAIL_STATUSES = ["pending", "ready", "failed"] as const;
type ThumbnailStatus = (typeof THUMBNAIL_STATUSES)[number];

function parseThumbnailStatus(value: unknown): ThumbnailStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return THUMBNAIL_STATUSES.includes(normalized as ThumbnailStatus)
    ? (normalized as ThumbnailStatus)
    : null;
}

function readSecret(req: Request): string | null {
  return req.headers.get("x-thumbnail-secret") ?? req.headers.get("x-sync-secret");
}

export async function PATCH(req: Request) {
  try {
    const secret = process.env.VIDEO_THUMBNAIL_SECRET || process.env.VIDEO_SYNC_SECRET;
    if (secret && readSecret(req) !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const id = body.id ? String(body.id).trim() : "";
    const gcsPath = body.gcsPath ? String(body.gcsPath).trim() : "";
    if (!id && !gcsPath) {
      return NextResponse.json({ error: "id or gcsPath is required" }, { status: 400 });
    }

    const thumbnailStatus = parseThumbnailStatus(body.thumbnailStatus);
    if (!thumbnailStatus) {
      return NextResponse.json(
        { error: "thumbnailStatus must be one of: pending, ready, failed" },
        { status: 400 }
      );
    }

    const thumbnailKey = body.thumbnailKey == null ? undefined : String(body.thumbnailKey).trim() || null;
    const thumbnailUrlRaw =
      body.thumbnailUrl == null ? undefined : String(body.thumbnailUrl).trim() || null;
    const thumbnailError =
      body.thumbnailError == null ? undefined : String(body.thumbnailError).trim() || null;

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
      where: id ? { id } : { gcsPath },
      data: {
        thumbnailStatus,
        thumbnailKey,
        thumbnailUrl,
        thumbnailGeneratedAt: thumbnailStatus === "ready" ? new Date() : null,
        thumbnailError,
      },
    });

    return NextResponse.json(video);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to update thumbnail" }, { status: 500 });
  }
}
