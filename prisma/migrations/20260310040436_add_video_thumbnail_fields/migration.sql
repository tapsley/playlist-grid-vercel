-- CreateEnum
CREATE TYPE "ThumbnailStatus" AS ENUM ('pending', 'ready', 'failed');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "thumbnailError" TEXT,
ADD COLUMN     "thumbnailGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "thumbnailKey" TEXT,
ADD COLUMN     "thumbnailStatus" "ThumbnailStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "thumbnailUrl" TEXT;

-- CreateIndex
CREATE INDEX "Video_thumbnailStatus_idx" ON "Video"("thumbnailStatus");
