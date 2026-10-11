-- Setup wizard (CS-02, D-74): which steps each company has done or skipped,
-- e.g. {"profile": "done", "workWeek": "skipped"}. Existing companies start with none.
-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "setup_steps" JSONB NOT NULL DEFAULT '{}';
