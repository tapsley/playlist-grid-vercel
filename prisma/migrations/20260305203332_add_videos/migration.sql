-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "game" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "updatedAt" TIMESTAMP(3),
    "gcsPath" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indexedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_gcsPath_key" ON "Video"("gcsPath");

-- CreateIndex
CREATE INDEX "Video_game_idx" ON "Video"("game");

-- CreateIndex
CREATE INDEX "Video_name_idx" ON "Video"("name");

-- CreateIndex
CREATE INDEX "Video_updatedAt_idx" ON "Video"("updatedAt");
