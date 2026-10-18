import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { runInCompany } from '../common/tenancy/tenant-context.js';
import { EmployeeStatusService } from './employee-status.service.js';

/** Catch up after downtime, then apply due changes within one minute of local midnight. */
@Injectable()
export class EmployeeStatusWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private readonly logger = new Logger(EmployeeStatusWorker.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: EmployeeStatusService,
  ) {}
  async onModuleInit() {
    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
  tick(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run() {
    try {
      const companies = await this.prisma.company.findMany({
        select: { id: true },
      });
      for (const company of companies)
        await runInCompany(company.id, () => this.statuses.refreshCurrent());
    } catch (error) {
      this.logger.error('Failed to apply due employee statuses', error);
    }
  }
}
