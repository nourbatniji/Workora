-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "employee_id" TEXT;

-- CreateIndex
CREATE INDEX "audit_log_company_id_employee_id_created_at_idx" ON "audit_log"("company_id", "employee_id", "created_at");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employees"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
