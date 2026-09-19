-- AlterTable
ALTER TABLE "ProductionTask" ADD COLUMN     "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProductionTask_barcode_key" ON "ProductionTask"("barcode");
