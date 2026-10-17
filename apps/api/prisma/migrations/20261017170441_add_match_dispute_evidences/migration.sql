-- CreateTable
CREATE TABLE "match_dispute_evidences" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_dispute_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_dispute_evidences_matchId_idx" ON "match_dispute_evidences"("matchId");

-- CreateIndex
CREATE INDEX "match_dispute_evidences_captainId_idx" ON "match_dispute_evidences"("captainId");

-- AddForeignKey
ALTER TABLE "match_dispute_evidences" ADD CONSTRAINT "match_dispute_evidences_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_dispute_evidences" ADD CONSTRAINT "match_dispute_evidences_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
