import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import { Prisma } from "@prisma/client";
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
    : { projectId: process.env.GCP_PROJECT_ID }
);

function slug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\- ]/g, "")
    .replace(/\s+/g, "-");
}

function toPublicUrl(bucket: string, objectName: string) {
  const encoded = encodeURIComponent(objectName).replace(/%2F/g, "/");
  return `https://storage.googleapis.com/${bucket}/${encoded}`;
}

function parseTags(value: FormDataEntryValue | FormDataEntryValue[] | null): string[] {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((entry) => String(entry).trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
  }

  if (typeof value === "string") {
    return [...new Set(value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
  }

  return [];
}

export async function POST(req: Request) {
    try{
        if (!bucketName) {
            return NextResponse.json({ error: "Missing GCS_BUCKET_NAME" }, { status: 500 });
        }

        const form = await req.formData();
        const file = form.get("file");
        const title = String(form.get("title") ?? "").trim();
        const description = String(form.get("description") ?? "").trim() || null;
        const tags = parseTags(form.getAll("tags").length ? form.getAll("tags") : form.get("tags"));
        const name = title;
        const game = String(form.get("game") ?? "").trim();

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "file is required" }, { status: 400 });
        }
        if (!name) {
            return NextResponse.json({ error: "title is required" }, { status: 400 });
        }

        const gameSlug = slug(game || "unknown");
        const safeName = file.name.replace(/[^\w.\-]/g, "_");
        const gcsPath = `${gameSlug}/${Date.now()}-${safeName}`;

        const bytes = Buffer.from(await file.arrayBuffer());

        await storage.bucket(bucketName).file(gcsPath).save(bytes, {
            contentType: file.type || "application/octet-stream",
            resumable: false,
            metadata: {
            metadata: {
              game,
              name,
              title,
              description: description ?? "",
              tags: tags.join(","),
            },
            },
        });

        const url = toPublicUrl(bucketName, gcsPath);

        const maxInt = 2147483647;
        const size = file.size > maxInt ? null : file.size; // avoid Int overflow

        const video = await prisma.video.upsert({
            where: { gcsPath },
            create: {
            name,
            title,
            description,
            tags,
            game: game || null,
            contentType: file.type || null,
            size,
            updatedAt: new Date(),
            gcsPath,
            url,
            thumbnailStatus: "pending",
            },
            update: {
            name,
            title,
            description,
            tags,
            game: game || null,
            contentType: file.type || null,
            size,
            updatedAt: new Date(),
            url,
            thumbnailStatus: "pending",
            thumbnailGeneratedAt: null,
            thumbnailError: null,
            },
        });

        return NextResponse.json(video, { status: 201 });
    } catch (e) {
        console.error("upload error:", e);

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Database error", code: e.code, detail: e.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Upload failed",
        detail: process.env.NODE_ENV === "development" && e instanceof Error ? e.message : undefined,
      },
      { status: 500 }
    );
    }
}