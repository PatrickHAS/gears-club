/*
  Warnings:

  - A unique constraint covering the columns `[reservationId]` on the table `matches` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "reservationId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "matches_reservationId_key" ON "matches"("reservationId");
