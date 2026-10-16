-- CreateTable
CREATE TABLE "player_ratings" (
    "id" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "elo" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_ratings_playerProfileId_key" ON "player_ratings"("playerProfileId");

-- CreateIndex
CREATE INDEX "player_ratings_elo_idx" ON "player_ratings"("elo");

-- AddForeignKey
ALTER TABLE "player_ratings" ADD CONSTRAINT "player_ratings_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
