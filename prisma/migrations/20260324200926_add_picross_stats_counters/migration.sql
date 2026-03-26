-- AlterTable
ALTER TABLE "PicrossProgress" ADD COLUMN     "easySeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hardSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mediumSeconds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PicrossStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fastestEasy" INTEGER,
    "fastestMedium" INTEGER,
    "fastestHard" INTEGER,
    "solvedEasy" INTEGER NOT NULL DEFAULT 0,
    "solvedMedium" INTEGER NOT NULL DEFAULT 0,
    "solvedHard" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PicrossStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PicrossStats_userId_key" ON "PicrossStats"("userId");

-- AddForeignKey
ALTER TABLE "PicrossStats" ADD CONSTRAINT "PicrossStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
