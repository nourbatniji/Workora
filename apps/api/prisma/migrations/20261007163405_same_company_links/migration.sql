/*
  Warnings:

  - You are about to drop the column `owner_id` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `owner_type` on the `documents` table. All the data in the column will be lost.
  - Added the required column `employee_id` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employees" DROP CONSTRAINT "employees_job_title_id_fkey";

-- DropForeignKey
ALTER TABLE "salary_history" DROP CONSTRAINT "salary_history_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_status_history" DROP CONSTRAINT "employee_status_history_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_previous_contract_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropIndex
DROP INDEX "users_employee_id_key";

-- DropIndex
DROP INDEX "contracts_previous_contract_id_key";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "owner_id",
DROP COLUMN "owner_type",
ADD COLUMN     "employee_id" TEXT NOT NULL;

-- DropEnum
DROP TYPE "DocumentOwnerType";

-- CreateIndex
CREATE UNIQUE INDEX "users_id_company_id_key" ON "users"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_company_id_key" ON "users"("employee_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_titles_id_company_id_key" ON "job_titles"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_id_company_id_key" ON "employees"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_id_company_id_key" ON "contracts"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_previous_contract_id_company_id_key" ON "contracts"("previous_contract_id", "company_id");

-- AddForeignKey
ALTER TABLE "company_settings_versions" ADD CONSTRAINT "company_settings_versions_created_by_company_id_fkey" FOREIGN KEY ("created_by", "company_id") REFERENCES "users"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employees"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_title_id_company_id_fkey" FOREIGN KEY ("job_title_id", "company_id") REFERENCES "job_titles"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employees"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_created_by_company_id_fkey" FOREIGN KEY ("created_by", "company_id") REFERENCES "users"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employees"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_changed_by_company_id_fkey" FOREIGN KEY ("changed_by", "company_id") REFERENCES "users"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employees"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_company_id_fkey" FOREIGN KEY ("uploaded_by", "company_id") REFERENCES "users"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employees"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_previous_contract_id_company_id_fkey" FOREIGN KEY ("previous_contract_id", "company_id") REFERENCES "contracts"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_company_id_fkey" FOREIGN KEY ("user_id", "company_id") REFERENCES "users"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
