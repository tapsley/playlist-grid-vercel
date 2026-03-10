import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { Storage } from "@google-cloud/storage";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error", "warn"] });

function loadDotEnvFile(filePath) {
  return fs
    .readFile(filePath, "utf8")
    .then((content) => {
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIndex = line.indexOf("=");
        if (eqIndex <= 0) continue;
        const key = line.slice(0, eqIndex).trim();
        let value = line.slice(eqIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (!(key in process.env)) {
          process.env[key] = value;
        }
      }
    })
    .catch(() => {
      // File is optional.
    });
}

async function loadEnv() {
  await loadDotEnvFile(path.resolve(".env"));
  await loadDotEnvFile(path.resolve(".env.local"));
}

function parseArgs(argv) {
  const parsed = {
    limit: 10,
    seek: Number(process.env.THUMBNAIL_SEEK_SECONDS ?? "1"),
    width: Number(process.env.THUMBNAIL_WIDTH ?? "640"),
    dryRun: false,
    id: null,
    gcsPath: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--help" || token === "-h") {
      parsed.help = true;
    } else if (token === "--dry-run") {
      parsed.dryRun = true;
    } else if (token === "--limit" && next) {
      parsed.limit = Math.max(1, Number(next) || 10);
      i++;
    } else if (token === "--seek" && next) {
      parsed.seek = Math.max(0, Number(next) || 1);
      i++;
    } else if (token === "--width" && next) {
      parsed.width = Math.max(64, Number(next) || 640);
      i++;
    } else if (token === "--id" && next) {
      parsed.id = String(next).trim();
      i++;
    } else if (token === "--gcs-path" && next) {
      parsed.gcsPath = String(next).trim();
      i++;
    }
  }

  return parsed;
}

function toPublicUrl(bucket, objectName) {
  const encoded = encodeURIComponent(objectName).replace(/%2F/g, "/");
  return `https://storage.googleapis.com/${bucket}/${encoded}`;
}

function toThumbnailKey(gcsPath) {
  const withoutExt = gcsPath.replace(/\.[^/.]+$/, "");
  return `thumbnails/${withoutExt}.jpg`;
}

function runFfmpeg({ ffmpegPath, inputFile, outputFile, seekSeconds, width }) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-ss",
      String(seekSeconds),
      "-i",
      inputFile,
      "-frames:v",
      "1",
      "-vf",
      `scale=${width}:-1`,
      "-q:v",
      "2",
      outputFile,
    ];

    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${stderr.slice(-500)}`));
      }
    });
  });
}

async function assertFfmpegAvailable(ffmpegPath) {
  if (ffmpegPath.includes("\\") || ffmpegPath.includes("/")) {
    try {
      await access(ffmpegPath);
      return;
    } catch {
      throw new Error(`FFmpeg not found at FFMPEG_PATH: ${ffmpegPath}`);
    }
  }

  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ["-version"], { stdio: ["ignore", "pipe", "pipe"] });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Unable to run ffmpeg via PATH (exit ${code}).`));
      }
    });
  }).catch((error) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `FFmpeg is not available. Install ffmpeg and/or set FFMPEG_PATH to the full ffmpeg.exe path. Details: ${reason}`
    );
  });
}

async function processVideo({ storage, bucketName, ffmpegPath, seekSeconds, width, video }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thumb-worker-"));
  const localVideoPath = path.join(tempDir, "input.mp4");
  const localThumbPath = path.join(tempDir, "thumb.jpg");
  const thumbnailKey = toThumbnailKey(video.gcsPath);

  try {
    const sourceFile = storage.bucket(bucketName).file(video.gcsPath);
    await sourceFile.download({ destination: localVideoPath });

    await runFfmpeg({
      ffmpegPath,
      inputFile: localVideoPath,
      outputFile: localThumbPath,
      seekSeconds,
      width,
    });

    const imageBuffer = await fs.readFile(localThumbPath);

    await storage.bucket(bucketName).file(thumbnailKey).save(imageBuffer, {
      contentType: "image/jpeg",
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    const thumbnailUrl = toPublicUrl(bucketName, thumbnailKey);

    await prisma.video.update({
      where: { id: video.id },
      data: {
        thumbnailKey,
        thumbnailUrl,
        thumbnailStatus: "ready",
        thumbnailGeneratedAt: new Date(),
        thumbnailError: null,
      },
    });

    return { ok: true, id: video.id, gcsPath: video.gcsPath, thumbnailKey };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown thumbnail error";

    await prisma.video.update({
      where: { id: video.id },
      data: {
        thumbnailStatus: "failed",
        thumbnailError: message.slice(0, 2000),
        thumbnailGeneratedAt: null,
      },
    });

    return { ok: false, id: video.id, gcsPath: video.gcsPath, error: message };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  await loadEnv();

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: npm run thumbnail:worker -- [options]\n\nOptions:\n  --limit <n>       Number of pending videos to process (default: 10)\n  --id <videoId>    Process one video by database id\n  --gcs-path <path> Process one video by gcsPath\n  --seek <seconds>  Frame timestamp for ffmpeg (default: 1)\n  --width <px>      Output thumbnail width (default: 640)\n  --dry-run         Show what would be processed without writing\n  -h, --help        Show help\n`);
    return;
  }

  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing GCS_BUCKET_NAME");
  }

  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
  await assertFfmpegAvailable(ffmpegPath);

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

  const where = args.id
    ? { id: args.id }
    : args.gcsPath
      ? { gcsPath: args.gcsPath }
      : { thumbnailStatus: "pending" };

  const videos = await prisma.video.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: args.id || args.gcsPath ? 1 : args.limit,
    select: {
      id: true,
      gcsPath: true,
      thumbnailStatus: true,
    },
  });

  if (!videos.length) {
    console.log("No videos matched the worker query.");
    return;
  }

  if (args.dryRun) {
    console.log(`Dry run: ${videos.length} video(s) would be processed.`);
    for (const item of videos) {
      console.log(`- ${item.id} :: ${item.gcsPath} -> ${toThumbnailKey(item.gcsPath)}`);
    }
    return;
  }

  let ready = 0;
  let failed = 0;

  for (const video of videos) {
    const result = await processVideo({
      storage,
      bucketName,
      ffmpegPath,
      seekSeconds: args.seek,
      width: args.width,
      video,
    });

    if (result.ok) {
      ready++;
      console.log(`READY  ${result.id}  ${result.thumbnailKey}`);
    } else {
      failed++;
      console.error(`FAILED ${result.id}  ${result.error}`);
    }
  }

  console.log(`Completed. processed=${videos.length} ready=${ready} failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Worker failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
