/*
  Warnings:

  - A unique constraint covering the columns `[company_id,national_id]` on the table `employees` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "next_employee_number" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_national_id_key" ON "employees"("company_id", "national_id");
