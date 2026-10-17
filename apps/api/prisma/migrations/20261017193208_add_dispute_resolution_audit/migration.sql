/*
  Warnings:

  - Added the required column `gamertagsVerified` to the `match_dispute_resolutions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "match_dispute_resolutions" ADD COLUMN     "evidenceIds" TEXT[],
ADD COLUMN     "gamertagsVerified" BOOLEAN NOT NULL;
