-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "edgeTapeDeducted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sheetsUsed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EdgeTape" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" "Color" NOT NULL,
    "thickness" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "stockMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdgeTape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EdgeTape_type_color_thickness_key" ON "EdgeTape"("type", "color", "thickness");
