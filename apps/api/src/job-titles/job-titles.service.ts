// Job titles (CS-09, FR-CS-9): add, rename, remove. A title that employees still use can't be
// removed (D-48); the database refuses it too (foreign key, onDelete: Restrict).
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JobTitleInput } from '@mdarj/shared';
import { requireCompanyId } from '../common/tenancy/tenant-context.js';
import { TenantPrismaService } from '../prisma/tenant-prisma.service.js';

/** What the API shows: the names and how many employees use the title */
const PUBLIC_JOB_TITLE = {
  id: true,
  nameAr: true,
  nameEn: true,
  _count: { select: { employees: true } },
} as const;

type Row = {
  id: string;
  nameAr: string;
  nameEn: string;
  _count: { employees: number };
};

/** { id, nameAr, nameEn, employeeCount } */
function toJobTitle(row: Row) {
  return {
    id: row.id,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    employeeCount: row._count.employees,
  };
}

@Injectable()
export class JobTitlesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** GET /job-titles: the whole list (a company has tens, not thousands), A→Z in English */
  async list() {
    const rows = await this.tenantPrisma.db.jobTitle.findMany({
      select: PUBLIC_JOB_TITLE,
      orderBy: { nameEn: 'asc' },
    });
    return { items: rows.map(toJobTitle) };
  }

  /** POST /job-titles */
  async create(input: JobTitleInput) {
    await this.assertNameFree(input);
    const row = await this.tenantPrisma.db.jobTitle.create({
      data: { companyId: requireCompanyId(), ...input },
      select: PUBLIC_JOB_TITLE,
    });
    return toJobTitle(row);
  }

  /** PATCH /job-titles/:id: rename (employees keep it; they show the new name) */
  async rename(id: string, input: JobTitleInput) {
    await this.findOrThrow(id);
    await this.assertNameFree(input, id);
    const row = await this.tenantPrisma.db.jobTitle.update({
      where: { id },
      data: input,
      select: PUBLIC_JOB_TITLE,
    });
    return toJobTitle(row);
  }

  /** DELETE /job-titles/:id: refused while any employee has it (D-48) */
  async remove(id: string) {
    const title = await this.findOrThrow(id);
    if (title._count.employees > 0) {
      // The list already shows how many employees use it (employeeCount)
      throw new ConflictException({ message: 'jobTitleInUse' });
    }
    await this.tenantPrisma.db.jobTitle.delete({ where: { id } });
  }

  /** This company's title, or 404 (another company's is "not found", D-57) */
  private async findOrThrow(id: string) {
    const title = await this.tenantPrisma.db.jobTitle.findUnique({
      where: { id },
      select: PUBLIC_JOB_TITLE,
    });
    if (!title) throw new NotFoundException({ message: 'notFound' });
    return title;
  }

  /** Two titles with the same name would be impossible to tell apart when picking one */
  private async assertNameFree(input: JobTitleInput, exceptId?: string) {
    const same = await this.tenantPrisma.db.jobTitle.findFirst({
      where: {
        id: exceptId ? { not: exceptId } : undefined,
        OR: [
          { nameEn: { equals: input.nameEn, mode: 'insensitive' } },
          { nameAr: input.nameAr },
        ],
      },
      select: { nameAr: true, nameEn: true },
    });
    if (!same) return;
    const errors: Record<string, string> = {};
    if (same.nameEn.toLowerCase() === input.nameEn.toLowerCase()) {
      errors.nameEn = 'jobTitleExists';
    }
    if (same.nameAr === input.nameAr) errors.nameAr = 'jobTitleExists';
    throw new ConflictException({ message: 'jobTitleExists', errors });
  }
}
