-- AlterTable
ALTER TABLE "PicrossStats" ADD COLUMN     "currentStreakEasy" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStreakHard" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStreakMedium" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSolvedEasy" TIMESTAMP(3),
ADD COLUMN     "lastSolvedHard" TIMESTAMP(3),
ADD COLUMN     "lastSolvedMedium" TIMESTAMP(3),
ADD COLUMN     "maxStreakEasy" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxStreakHard" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxStreakMedium" INTEGER NOT NULL DEFAULT 0;
