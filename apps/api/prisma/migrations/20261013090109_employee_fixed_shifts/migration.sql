-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntity" ADD VALUE 'shift_template';
ALTER TYPE "AuditEntity" ADD VALUE 'shift_assignment';

-- CreateTable
CREATE TABLE "shift_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "crosses_midnight" BOOLEAN NOT NULL,
    "break_minutes" INTEGER NOT NULL,
    "late_grace_minutes" INTEGER NOT NULL,
    "early_leave_grace_minutes" INTEGER NOT NULL,
    "working_days" INTEGER[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_template_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_templates_id_company_id_key" ON "shift_templates"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_templates_company_id_name_key" ON "shift_templates"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_employee_id_start_date_key" ON "shift_assignments"("employee_id", "start_date");

-- AddForeignKey
ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employees"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_template_id_company_id_fkey" FOREIGN KEY ("shift_template_id", "company_id") REFERENCES "shift_templates"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
