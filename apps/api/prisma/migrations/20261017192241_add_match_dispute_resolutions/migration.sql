-- CreateTable
CREATE TABLE "match_dispute_resolutions" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "winnerTeam" "MatchTeam" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_dispute_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_dispute_resolutions_matchId_key" ON "match_dispute_resolutions"("matchId");

-- CreateIndex
CREATE INDEX "match_dispute_resolutions_adminId_idx" ON "match_dispute_resolutions"("adminId");

-- AddForeignKey
ALTER TABLE "match_dispute_resolutions" ADD CONSTRAINT "match_dispute_resolutions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_dispute_resolutions" ADD CONSTRAINT "match_dispute_resolutions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
