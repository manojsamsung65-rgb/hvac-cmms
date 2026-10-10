-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('active', 'inactive', 'under_maintenance', 'retired');

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "siteId" TEXT,
    "buildingId" TEXT,
    "location" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "criticality" "Criticality" NOT NULL DEFAULT 'medium',
    "status" "EquipmentStatus" NOT NULL DEFAULT 'active',
    "commissioningDate" DATE,
    "warrantyProvider" TEXT,
    "warrantyStart" DATE,
    "warrantyEnd" DATE,
    "maintenanceNotes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sites_organizationId_idx" ON "sites"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "sites_organizationId_code_key" ON "sites"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sites_organizationId_id_key" ON "sites"("organizationId", "id");

-- CreateIndex
CREATE INDEX "buildings_organizationId_idx" ON "buildings"("organizationId");

-- CreateIndex
CREATE INDEX "buildings_organizationId_siteId_idx" ON "buildings"("organizationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_organizationId_code_key" ON "buildings"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_organizationId_id_key" ON "buildings"("organizationId", "id");

-- CreateIndex
CREATE INDEX "equipment_organizationId_idx" ON "equipment"("organizationId");

-- CreateIndex
CREATE INDEX "equipment_organizationId_status_idx" ON "equipment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "equipment_organizationId_category_idx" ON "equipment"("organizationId", "category");

-- CreateIndex
CREATE INDEX "equipment_organizationId_siteId_idx" ON "equipment"("organizationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_organizationId_code_key" ON "equipment"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_organizationId_id_key" ON "equipment"("organizationId", "id");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_entityType_entityId_idx" ON "audit_logs"("organizationId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_organizationId_siteId_fkey" FOREIGN KEY ("organizationId", "siteId") REFERENCES "sites"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_organizationId_siteId_fkey" FOREIGN KEY ("organizationId", "siteId") REFERENCES "sites"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_organizationId_buildingId_fkey" FOREIGN KEY ("organizationId", "buildingId") REFERENCES "buildings"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

