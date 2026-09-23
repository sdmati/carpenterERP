-- AlterEnum
ALTER TYPE "MachineType" ADD VALUE 'EDGE_BANDER';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'EDGE_BANDER_OPERATOR';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'EDGED';

-- AlterTable
ALTER TABLE "PartDefinition" ADD COLUMN     "edgeLength1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "edgeLength2" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "edgeTapeColor" "Color",
ADD COLUMN     "edgeTapeThickness" DOUBLE PRECISION,
ADD COLUMN     "edgeTapeType" TEXT,
ADD COLUMN     "edgeWidth1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "edgeWidth2" BOOLEAN NOT NULL DEFAULT false;
