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
  private running = false;
  private readonly logger = new Logger(EmployeeStatusWorker.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: EmployeeStatusService,
  ) {}
  onModuleInit() {
    void this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const companies = await this.prisma.company.findMany({
        select: { id: true },
      });
      for (const company of companies)
        await runInCompany(company.id, () => this.statuses.refreshCurrent());
    } catch (error) {
      this.logger.error('Failed to apply due employee statuses', error);
    } finally {
      this.running = false;
    }
  }
}
