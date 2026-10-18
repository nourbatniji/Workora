// Settings versions (CS-08, FR-CS-8, D-27, D-70): settings that change money or attendance are a
// stack of versions, each with a start date. The rules for a day = the latest version starting on
// or before that day. A change never edits a version already in force: it adds a new one.
import { BadRequestException, Injectable } from '@nestjs/common';
import type { SettingsChangeInput } from '@mdarj/shared';
import type { AuthContext } from '../auth/auth-context.js';
import { AuditService } from '../common/audit/audit.service.js';
import { requireCompanyId } from '../common/tenancy/tenant-context.js';
import type { CompanySettingsVersion } from '../generated/prisma/client.js';
import {
  lockCompanySettings,
  TenantPrismaService,
} from '../prisma/tenant-prisma.service.js';

/** "2026-11-01" ↔ the Date Prisma uses for a DATE column (midnight UTC, D-29) */
const toDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const toDay = (date: Date) => date.toISOString().slice(0, 10);

/** Today's date in a time zone, as "2026-10-11" */
export function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/** A version as the API shows it: dates as days, multipliers as strings (D-28) */
function toApi(
  row: CompanySettingsVersion & { createdBy?: { name: string | null } | null },
) {
  return {
    id: row.id,
    effectiveFrom: toDay(row.effectiveFrom),
    restDays: row.restDays,
    dailyRateDivisor: row.dailyRateDivisor,
    latenessPolicy: row.latenessPolicy,
    overtimeDayRate: row.overtimeDayRate.toFixed(2),
    overtimeNightRate: row.overtimeNightRate.toFixed(2),
    overtimeRestDayRate: row.overtimeRestDayRate.toFixed(2),
    overtimeHolidayRate: row.overtimeHolidayRate.toFixed(2),
    overtimeMinMinutes: row.overtimeMinMinutes,
    contractExpiringDays: row.contractExpiringDays,
    checkInWindowMinutes: row.checkInWindowMinutes,
    checkOutWindowMinutes: row.checkOutWindowMinutes,
    ipAllowList: row.ipAllowList,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy?.name ?? null,
  };
}

@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Today in this company's own time zone (FR-CS-3) */
  async today(): Promise<string> {
    const company = await this.tenantPrisma.db.company.findUniqueOrThrow({
      where: { id: requireCompanyId() },
      select: { timeZone: true },
    });
    return todayIn(company.timeZone);
  }

  /** The version in force on a day: the latest one starting on or before it */
  async inForceOn(day: string) {
    return this.tenantPrisma.db.companySettingsVersion.findFirst({
      where: { effectiveFrom: { lte: toDate(day) } },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * The first date a change may start (D-70): today or later, and after every shift date that
   * already has an attendance record, an exception or a payroll item, because a version in use
   * is never changed. Attendance, exceptions and payroll are not built yet, so for now this is
   * today. Each of those features adds its check here (latest shift date + 1 day).
   * Call it inside the transaction that holds the settings lock, so the answer stays true until
   * the save is done.
   */
  async earliestEffectiveFrom(): Promise<string> {
    return this.today();
  }

  /** GET /company/settings?date= (default today) */
  async settingsOn(day?: string) {
    const date = day ?? (await this.today());
    const version = await this.inForceOn(date);
    // Before the company's first version there are no rules yet
    return { date, version: version ? toApi(version) : null };
  }

  /** GET /company/settings/versions: newest first, with which one is in force today */
  async versions() {
    const [today, earliestEffectiveFrom, rows] = await Promise.all([
      this.today(),
      this.earliestEffectiveFrom(),
      this.tenantPrisma.db.companySettingsVersion.findMany({
        orderBy: { effectiveFrom: 'desc' },
        include: { createdBy: { select: { name: true } } },
      }),
    ]);
    const inForce = rows.find((row) => toDay(row.effectiveFrom) <= today);
    return {
      today,
      earliestEffectiveFrom,
      items: rows.map((row) => ({
        ...toApi(row),
        state:
          row.id === inForce?.id
            ? 'inForce'
            : toDay(row.effectiveFrom) > today
              ? 'scheduled'
              : 'past',
      })),
    };
  }

  /**
   * POST /company/settings/versions: the settings in force on `effectiveFrom`, with these
   * changes, become a version starting that day. Never before earliestEffectiveFrom (D-70). A
   * version already starting on that same day is replaced: no day it covers is in use yet.
   */
  async change(auth: AuthContext, input: SettingsChangeInput) {
    return this.tenantPrisma.db.$transaction(async (tx) => {
      // 1. Take the settings lock alone (D-70): no punch or exception can be written until this
      //    transaction ends, and a second save waits here for the first one to finish
      await lockCompanySettings(tx, 'exclusive');

      // 2. Check the date while holding the lock, so the answer cannot change before the save
      if (input.effectiveFrom < (await this.earliestEffectiveFrom())) {
        throw new BadRequestException({
          message: 'validationFailed',
          errors: { effectiveFrom: 'effectiveDateInPast' },
        });
      }

      // 3. Save
      const base = await tx.companySettingsVersion.findFirst({
        where: { effectiveFrom: { lte: toDate(input.effectiveFrom) } },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!base) {
        // Every company gets a first version at sign-up (CS-01), so this means broken data
        throw new Error('Company has no settings version');
      }

      // Only the settings this change carries; the rest stay as they are in force that day
      const { effectiveFrom, ...sent } = input;
      const changes = Object.fromEntries(
        Object.entries(sent).filter(([, value]) => value !== undefined),
      ) as Partial<Omit<SettingsChangeInput, 'effectiveFrom'>>;
      const before = toApi(base);
      const changedBefore = Object.fromEntries(
        Object.keys(changes).map((key) => [
          key,
          before[key as keyof typeof before],
        ]),
      );

      const sameDay = toDay(base.effectiveFrom) === effectiveFrom;

      const saved = sameDay
        ? await tx.companySettingsVersion.update({
            where: { id: base.id },
            data: { ...changes, createdById: auth.userId },
            include: { createdBy: { select: { name: true } } },
          })
        : await tx.companySettingsVersion.create({
            data: {
              companyId: requireCompanyId(),
              effectiveFrom: toDate(effectiveFrom),
              // Everything else is copied from the version in force that day
              restDays: base.restDays,
              dailyRateDivisor: base.dailyRateDivisor,
              latenessPolicy: base.latenessPolicy ?? { mode: 'exact' },
              overtimeDayRate: base.overtimeDayRate,
              overtimeNightRate: base.overtimeNightRate,
              overtimeRestDayRate: base.overtimeRestDayRate,
              overtimeHolidayRate: base.overtimeHolidayRate,
              overtimeMinMinutes: base.overtimeMinMinutes,
              contractExpiringDays: base.contractExpiringDays,
              checkInWindowMinutes: base.checkInWindowMinutes,
              checkOutWindowMinutes: base.checkOutWindowMinutes,
              ipAllowList: base.ipAllowList,
              ...changes,
              createdById: auth.userId,
            },
            include: { createdBy: { select: { name: true } } },
          });

      // Before = those settings in the version that applied that day; after = the new values
      await this.audit.record(tx, auth.userId, {
        entityType: 'company_settings',
        entityId: saved.id,
        action: sameDay ? 'update' : 'create',
        before: { effectiveFrom: before.effectiveFrom, ...changedBefore },
        after: { effectiveFrom, ...changes },
      });

      return toApi(saved);
    });
  }
}
