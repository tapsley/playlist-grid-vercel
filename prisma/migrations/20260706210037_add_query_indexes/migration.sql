-- CreateIndex
CREATE INDEX "PicrossMedal_type_difficulty_date_idx" ON "PicrossMedal"("type", "difficulty", "date");

-- CreateIndex
CREATE INDEX "PicrossProgress_date_idx" ON "PicrossProgress"("date");

-- CreateIndex
CREATE INDEX "PicrossProgress_updatedAt_idx" ON "PicrossProgress"("updatedAt");
