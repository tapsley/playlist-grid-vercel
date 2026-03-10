This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Thumbnail Worker

This project includes a worker script that processes videos with `thumbnailStatus = pending`,
extracts a JPG thumbnail using `ffmpeg`, uploads it to GCS, and updates the `Video` row.

Run it:

```bash
npm run thumbnail:worker
```

Common options:

```bash
# Process up to 25 pending videos
npm run thumbnail:worker -- --limit 25

# Process a single video by id
npm run thumbnail:worker -- --id <video-id>

# Process a single video by gcsPath
npm run thumbnail:worker -- --gcs-path <path/in/bucket.mp4>

# Dry run (no writes)
npm run thumbnail:worker -- --dry-run
```

Required env vars:

- `DIRECT_URL` (Prisma/Postgres)
- `GCS_BUCKET_NAME`
- `GCP_PROJECT_ID` (or runtime ADC)

Optional env vars:

- `GCP_CLIENT_EMAIL`
- `GCP_PRIVATE_KEY`
- `FFMPEG_PATH` (defaults to `ffmpeg`)
- `THUMBNAIL_SEEK_SECONDS` (default `1`)
- `THUMBNAIL_WIDTH` (default `640`)
