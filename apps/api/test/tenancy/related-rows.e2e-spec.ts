// FND-12 (SCRUM-175) / NFR-1: rows that point at other rows must stay inside one company.
// The tenancy guard checks each row's own company; these tests prove the database also refuses
// a link from a company-B row to a company-A row (D-48). Needs the local database: pnpm db:up
import { requireCompanyId } from '../../src/common/tenancy/tenant-context.js';
import { setupTwoCompanies, type TwoCompanies } from './two-companies.js';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// The fields an employee needs, for the company on the badge
function newEmployee(code: string, jobTitleId?: string) {
  return {
    companyId: requireCompanyId(),
    code,
    nameAr: 'موظف تجريبي',
    nameEn: `Employee ${code}`,
    employmentType: 'full_time' as const,
    hireDate: day('2026-01-01'),
    jobTitleId,
  };
}

describe('Linked rows stay in one company (FND-12, NFR-1)', () => {
  let t: TwoCompanies;
  // Company A's rows
  let employeeA: string;
  let jobTitleA: string;
  let salaryA: string;
  let contractA: string;
  let userA: string;
  // Company B's rows
  let employeeB: string;
  let contractB: string;

  beforeAll(async () => {
    t = await setupTwoCompanies();

    await t.asA(async () => {
      jobTitleA = (
        await t.db.jobTitle.create({
          data: {
            companyId: requireCompanyId(),
            nameAr: 'ممرض',
            nameEn: 'Nurse',
          },
        })
      ).id;
      employeeA = (
        await t.db.employee.create({ data: newEmployee('A-001', jobTitleA) })
      ).id;
      salaryA = (
        await t.db.salaryHistory.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeA,
            baseSalary: '9000.00',
            effectiveFrom: day('2026-01-01'),
          },
        })
      ).id;
      contractA = (
        await t.db.contract.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeA,
            type: 'indefinite',
            startDate: day('2026-01-01'),
          },
        })
      ).id;
      userA = (
        await t.db.user.create({
          data: {
            companyId: requireCompanyId(),
            email: `a-${requireCompanyId()}@related.test`,
            role: 'admin',
          },
        })
      ).id;
    });

    await t.asB(async () => {
      employeeB = (await t.db.employee.create({ data: newEmployee('B-001') }))
        .id;
      contractB = (
        await t.db.contract.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeB,
            type: 'indefinite',
            startDate: day('2026-01-01'),
          },
        })
      ).id;
    });
  });

  afterAll(async () => {
    await t.cleanup();
  });

  // ── Allowed: links inside one company ──

  it('company A reads its own salary row together with its own employee', async () => {
    const row = await t.asA(() =>
      t.db.salaryHistory.findUnique({
        where: { id: salaryA },
        include: { employee: true },
      }),
    );
    expect(row?.employee.id).toBe(employeeA);
  });

  it("company A reads its own employee's job title", async () => {
    const row = await t.asA(() =>
      t.db.employee.findUnique({
        where: { id: employeeA },
        include: { jobTitle: true },
      }),
    );
    expect(row?.jobTitle?.id).toBe(jobTitleA);
  });

  // ── Refused: company B cannot reach company A through a link ──

  it("company B cannot read company A's salary row, or its employee through it", async () => {
    const row = await t.asB(() =>
      t.db.salaryHistory.findUnique({
        where: { id: salaryA },
        include: { employee: true },
      }),
    );
    expect(row).toBeNull();
  });

  // Each attempt is a company-B row that points at a company-A row.
  // The database must refuse every one with a foreign key error (Prisma P2003).
  const crossCompanyCreates: [string, () => Promise<unknown>][] = [
    [
      "a salary row for company A's employee",
      () =>
        t.db.salaryHistory.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeA,
            baseSalary: '1.00',
            effectiveFrom: day('2026-02-01'),
          },
        }),
    ],
    [
      "a status change for company A's employee",
      () =>
        t.db.employeeStatusHistory.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeA,
            toStatus: 'suspended',
            effectiveDate: day('2026-02-01'),
          },
        }),
    ],
    [
      "a contract for company A's employee",
      () =>
        t.db.contract.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeA,
            type: 'indefinite',
            startDate: day('2026-02-01'),
          },
        }),
    ],
    [
      "a contract that renews company A's contract",
      () =>
        t.db.contract.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeB,
            type: 'indefinite',
            startDate: day('2026-02-01'),
            previousContractId: contractA,
          },
        }),
    ],
    [
      "an employee with company A's job title",
      () => t.db.employee.create({ data: newEmployee('B-002', jobTitleA) }),
    ],
    [
      "a login linked to company A's employee",
      () =>
        t.db.user.create({
          data: {
            companyId: requireCompanyId(),
            email: `b-${requireCompanyId()}@related.test`,
            role: 'employee',
            employeeId: employeeA,
          },
        }),
    ],
    [
      "a session for company A's user",
      () =>
        t.db.session.create({
          data: {
            companyId: requireCompanyId(),
            userId: userA,
            tokenHash: `probe-${requireCompanyId()}`,
          },
        }),
    ],
    [
      "a document for company A's employee",
      () =>
        t.db.document.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeA,
            docType: 'national_id',
            fileKey: 'probe/file.pdf',
          },
        }),
    ],
    [
      "a salary row recorded as created by company A's user",
      () =>
        t.db.salaryHistory.create({
          data: {
            companyId: requireCompanyId(),
            employeeId: employeeB,
            baseSalary: '1.00',
            effectiveFrom: day('2026-03-01'),
            createdById: userA,
          },
        }),
    ],
  ];

  it.each(crossCompanyCreates)(
    'company B cannot create %s',
    async (_name, create) => {
      await expect(t.asB(create)).rejects.toMatchObject({ code: 'P2003' });
    },
  );

  // ── Refused: an existing row cannot be re-pointed at another company ──

  it("company A cannot move its salary row onto company B's employee", async () => {
    await expect(
      t.asA(() =>
        t.db.salaryHistory.update({
          where: { id: salaryA },
          data: { employeeId: employeeB },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it("company B cannot point its contract at company A's contract", async () => {
    await expect(
      t.asB(() =>
        t.db.contract.update({
          where: { id: contractB },
          data: { previousContractId: contractA },
        }),
      ),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('nothing above reached the database', async () => {
    const strays = await t.prisma.salaryHistory.count({
      where: { companyId: t.companyB, employeeId: employeeA },
    });
    const salary = await t.prisma.salaryHistory.findUniqueOrThrow({
      where: { id: salaryA },
    });
    expect(strays).toBe(0);
    expect(salary.employeeId).toBe(employeeA);
  });
});
