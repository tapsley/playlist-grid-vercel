-- AlterTable
ALTER TABLE "PicrossStats" ADD COLUMN     "goldMedalsEasy" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "goldMedalsHard" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "goldMedalsMedium" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "silverMedalsEasy" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "silverMedalsHard" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "silverMedalsMedium" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PicrossMedal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "difficulty" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PicrossMedal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PicrossMedal_userId_idx" ON "PicrossMedal"("userId");

-- CreateIndex
CREATE INDEX "PicrossMedal_date_idx" ON "PicrossMedal"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PicrossMedal_userId_date_difficulty_key" ON "PicrossMedal"("userId", "date", "difficulty");

-- AddForeignKey
ALTER TABLE "PicrossMedal" ADD CONSTRAINT "PicrossMedal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
