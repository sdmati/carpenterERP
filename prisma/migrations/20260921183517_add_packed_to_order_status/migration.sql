/*
  Warnings:

  - Changed the type of `type` on the `Machine` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MachineType" AS ENUM ('DRILL', 'SAW');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PACKED';

-- AlterTable
ALTER TABLE "Machine" DROP COLUMN "type",
ADD COLUMN     "type" "MachineType" NOT NULL;
