-- CreateTable
CREATE TABLE "PicrossProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "easy" JSONB NOT NULL,
    "medium" JSONB NOT NULL,
    "hard" JSONB NOT NULL,
    "easyComplete" BOOLEAN NOT NULL DEFAULT false,
    "mediumComplete" BOOLEAN NOT NULL DEFAULT false,
    "hardComplete" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PicrossProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PicrossPuzzle" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "easy" JSONB NOT NULL,
    "medium" JSONB NOT NULL,
    "hard" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PicrossPuzzle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PicrossProgress_userId_date_key" ON "PicrossProgress"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PicrossPuzzle_date_key" ON "PicrossPuzzle"("date");

-- AddForeignKey
ALTER TABLE "PicrossProgress" ADD CONSTRAINT "PicrossProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
