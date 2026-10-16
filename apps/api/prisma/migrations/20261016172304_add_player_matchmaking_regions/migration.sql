-- CreateTable
CREATE TABLE "player_matchmaking_regions" (
    "id" TEXT NOT NULL,
    "playerProfileId" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_matchmaking_regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_matchmaking_regions_country_idx" ON "player_matchmaking_regions"("country");

-- CreateIndex
CREATE UNIQUE INDEX "player_matchmaking_regions_playerProfileId_country_key" ON "player_matchmaking_regions"("playerProfileId", "country");

-- AddForeignKey
ALTER TABLE "player_matchmaking_regions" ADD CONSTRAINT "player_matchmaking_regions_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
