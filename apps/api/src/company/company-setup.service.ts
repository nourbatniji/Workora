// Setup wizard progress (CS-02, D-74): companies.setup_steps holds { step: 'done' | 'skipped' }.
// A step not in it is still to do. Setup is complete when every step is done or skipped.
import { Injectable } from '@nestjs/common';
import {
  SETUP_STEPS,
  type SetupStepStatus,
  type SetupStepUpdate,
} from '@mdarj/shared';
import { requireCompanyId } from '../common/tenancy/tenant-context.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service.js';

type Stored = Partial<Record<string, SetupStepStatus>>;

/** Reads the stored JSON, keeping only steps and statuses this version knows */
function readSteps(value: unknown): Stored {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const stored: Stored = {};
  for (const [step, status] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (
      (SETUP_STEPS as readonly string[]).includes(step) &&
      (status === 'done' || status === 'skipped')
    ) {
      stored[step] = status;
    }
  }
  return stored;
}

/** The answer of GET and PATCH /company/setup: every step in order, and whether all are handled */
function toProgress(stored: Stored) {
  const steps = SETUP_STEPS.map((key) => ({
    key,
    status: stored[key] ?? ('todo' as const),
  }));
  return { steps, complete: steps.every((step) => step.status !== 'todo') };
}

@Injectable()
export class CompanySetupService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** GET /company/setup */
  async progress() {
    const company = await this.tenantPrisma.db.company.findUniqueOrThrow({
      where: { id: requireCompanyId() },
      select: { setupSteps: true },
    });
    return toProgress(readSteps(company.setupSteps));
  }

  /** PATCH /company/setup: one step done or skipped; "done" never goes back to "skipped" */
  async mark(input: SetupStepUpdate) {
    const id = requireCompanyId();
    return this.tenantPrisma.db.$transaction(async (tx) => {
      const company = await tx.company.findUniqueOrThrow({
        where: { id },
        select: { setupSteps: true },
      });
      const stored = readSteps(company.setupSteps);
      if (!(stored[input.step] === 'done' && input.status === 'skipped')) {
        stored[input.step] = input.status;
      }
      await tx.company.update({
        where: { id },
        data: { setupSteps: stored },
      });
      return toProgress(stored);
    });
  }
}
