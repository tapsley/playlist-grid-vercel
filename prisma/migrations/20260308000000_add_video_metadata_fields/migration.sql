-- AlterTable
ALTER TABLE "Video"
ADD COLUMN "title" TEXT,
ADD COLUMN "description" TEXT,
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Video_title_idx" ON "Video"("title");
