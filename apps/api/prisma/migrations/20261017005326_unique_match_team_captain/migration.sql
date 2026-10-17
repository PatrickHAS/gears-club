-- This is an empty migration.
-- Permite no máximo um capitão por equipe em cada partida.
CREATE UNIQUE INDEX "match_participants_unique_team_captain"
ON "match_participants" ("matchId", "team")
WHERE "isCaptain" = true;
