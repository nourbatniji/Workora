-- Preserve employee identity for immutable audit references after directory removal.
ALTER TABLE "employees" ADD COLUMN "deleted_at" TIMESTAMP(3);
