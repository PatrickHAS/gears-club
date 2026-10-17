-- CreateTable
CREATE TABLE "match_result_reports" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "winnerTeam" "MatchTeam" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_result_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_result_reports_matchId_idx" ON "match_result_reports"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "match_result_reports_matchId_captainId_key" ON "match_result_reports"("matchId", "captainId");

-- AddForeignKey
ALTER TABLE "match_result_reports" ADD CONSTRAINT "match_result_reports_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_result_reports" ADD CONSTRAINT "match_result_reports_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "player_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
