import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bucketName = process.env.GCS_BUCKET_NAME as string;

const storage = new Storage(
  process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY
    ? {
        projectId: process.env.GCP_PROJECT_ID,
        credentials: {
          client_email: process.env.GCP_CLIENT_EMAIL,
          private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
      }
    : { projectId: process.env.GCP_PROJECT_ID } // ADC fallback
);

function toPublicUrl(bucket: string, objectName: string) {
  const encoded = encodeURIComponent(objectName).replace(/%2F/g, "/");
  return `https://storage.googleapis.com/${bucket}/${encoded}`;
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeGameName(raw: string) {
  // "halo_infinite" -> "Halo Infinite", "call.of-duty" -> "Call Of Duty"
  const cleaned = raw
    .trim()
    .replace(/\.[^/.]+$/, "")   // remove extension if present
    .replace(/[_+.]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ");

  return cleaned ? toTitleCase(cleaned) : "";
}

function inferGame(gcsPath: string, metadataGame?: string | null) {
  if (metadataGame && metadataGame.trim()) {
    return normalizeGameName(metadataGame);
  }

  // infer from filename prefix before first '-'
  // "halo-ranked-match1.mp4" -> "Halo"
  const fileName = gcsPath.split("/").pop() ?? gcsPath;
  const base = fileName.replace(/\.[^/.]+$/, "");
  const prefix = base.split("-")[0] ?? "";

  const normalized = normalizeGameName(prefix);
  return normalized || null;
}

function normalizeTitle(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/[_+.]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/\s+/g, " ");

  return cleaned ? toTitleCase(cleaned) : "";
}

function inferTitle(gcsPath: string) {
  const fileName = gcsPath.split("/").pop() ?? gcsPath;
  const base = fileName.replace(/\.[^/.]+$/, "");
  const parts = base.split("-").map((part) => part.trim()).filter(Boolean);

  const rawTitle = parts.length > 1 ? parts.slice(1).join(" ") : base;
  const normalized = normalizeTitle(rawTitle);
  return normalized || normalizeTitle(base);
}

function inferName(gcsPath: string) {
  const fileName = gcsPath.split("/").pop() ?? gcsPath;
  return fileName.replace(/\.[^/.]+$/, "");
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => String(v).trim().toLowerCase()).filter(Boolean))];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return [...new Set(parsed.map((v) => String(v).trim().toLowerCase()).filter(Boolean))];
        }
      } catch {
        // fallback to CSV parsing
      }
    }

    return [...new Set(trimmed.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean))];
  }

  return [];
}

function toSafeInt(value?: string | number | null) {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const maxInt = 2147483647; // Prisma Int
  return n > maxInt ? null : Math.trunc(n);
}

export async function POST(req: Request) {
  try {
    if (!bucketName) {
      return NextResponse.json({ error: "Missing GCS_BUCKET_NAME" }, { status: 500 });
    }

    // Optional protection
    const syncSecret = process.env.VIDEO_SYNC_SECRET;
    if (syncSecret) {
      const provided = req.headers.get("x-sync-secret");
      if (provided !== syncSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    let body: { prefix?: string; limit?: number; dryRun?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // allow empty body
    }

    const prefix = String(body.prefix ?? "").trim();
    const limit = Math.min(Math.max(Number(body.limit ?? 500), 1), 5000);
    const dryRun = Boolean(body.dryRun);

    const [files] = await storage.bucket(bucketName).getFiles({
      prefix,
      autoPaginate: false,
      maxResults: limit,
    });

    const videos = files.filter((f) => (f.metadata?.contentType ?? "").startsWith("video/"));

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        scanned: files.length,
        videosFound: videos.length,
        preview: videos.slice(0, 20).map((f) => ({
          name: inferName(f.name),
          title:
            typeof f.metadata?.metadata?.title === "string"
              ? normalizeTitle(f.metadata.metadata.title) || inferTitle(f.name)
              : inferTitle(f.name),
          description: typeof f.metadata?.metadata?.description === "string" ? f.metadata.metadata.description.trim() || null : null,
          tags: parseTags(typeof f.metadata?.metadata?.tags === "string" ? f.metadata.metadata.tags : null),
          game: inferGame(f.name, typeof f.metadata?.metadata?.game === "string" ? f.metadata.metadata.game : null),
          gcsPath: f.name,
          url: toPublicUrl(bucketName, f.name),
          contentType: f.metadata?.contentType ?? null,
          size: toSafeInt(f.metadata?.size),
          updatedAt: f.metadata?.updated ?? null,
        })),
      });
    }

    let synced = 0;
    let failed = 0;
    const errors: Array<{ gcsPath: string; error: string }> = [];

    for (const f of videos) {
      const gcsPath = f.name;
      const name = inferName(gcsPath);
      const title =
        typeof f.metadata?.metadata?.title === "string"
          ? normalizeTitle(f.metadata.metadata.title) || inferTitle(gcsPath)
          : inferTitle(gcsPath);
      const game = inferGame(gcsPath, typeof f.metadata?.metadata?.game === "string" ? f.metadata.metadata.game : null);
      const url = toPublicUrl(bucketName, gcsPath);
      const contentType = f.metadata?.contentType ?? null;
      const size = toSafeInt(f.metadata?.size);
      const updatedAt = f.metadata?.updated ? new Date(f.metadata.updated) : null;

      try {
        await prisma.video.upsert({
          where: { gcsPath },
          create: {
            name,
            title,
            game,
            contentType,
            size,
            updatedAt,
            gcsPath,
            url,
            thumbnailStatus: "pending",
          },
          update: {
            name,
            title,
            game,
            contentType,
            size,
            updatedAt,
            url,
          },
        });
        synced++;
      } catch (e) {
        failed++;
        errors.push({
          gcsPath,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      scanned: files.length,
      videosFound: videos.length,
      synced,
      failed,
      errors: errors.slice(0, 25),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown sync error";
    return NextResponse.json(
      { error: "Sync failed", detail: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}