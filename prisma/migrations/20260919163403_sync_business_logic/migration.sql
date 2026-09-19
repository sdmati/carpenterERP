/*
  Warnings:

  - You are about to drop the column `barcode` on the `ProductionTask` table. All the data in the column will be lost.
  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `color` to the `Material` table without a default value. This is not possible if the table is not empty.
  - Added the required column `length` to the `Material` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thickness` to the `Material` table without a default value. This is not possible if the table is not empty.
  - Added the required column `width` to the `Material` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `PartDefinition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `thickness` to the `PartDefinition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `color` to the `ProductionOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `ProductionTask` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Color" AS ENUM ('SONOMA', 'WHITE', 'GRAY', 'BLACK');

-- DropForeignKey
ALTER TABLE "PartDefinition" DROP CONSTRAINT "PartDefinition_productId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- DropForeignKey
ALTER TABLE "ProductionTask" DROP CONSTRAINT "ProductionTask_orderId_fkey";

-- DropIndex
DROP INDEX "ProductionTask_barcode_key";

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "color" "Color" NOT NULL,
ADD COLUMN     "length" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "stockQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "thickness" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "width" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "stockArea" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "PartDefinition" ADD COLUMN     "quantity" INTEGER NOT NULL,
ADD COLUMN     "thickness" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "color" "Color" NOT NULL;

-- AlterTable
ALTER TABLE "ProductionTask" DROP COLUMN "barcode",
ADD COLUMN     "quantity" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "User";

-- AddForeignKey
ALTER TABLE "PartDefinition" ADD CONSTRAINT "PartDefinition_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionTask" ADD CONSTRAINT "ProductionTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
