// Employee list (EM-09, FR-EM-9): search, filters and sort. One schema for the page and the API (D-30).
// The shift filter comes with shifts (SH-02); the Excel export uses the same query.
import { z } from 'zod';
import { EMPLOYMENT_TYPES } from './create-employee.js';

export const EMPLOYEE_STATUSES = ['active', 'suspended', 'terminated'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Without a status filter the list shows the people who work here: Active and Suspended */
export const DEFAULT_EMPLOYEE_STATUSES: EmployeeStatus[] = [
  'active',
  'suspended',
];

/** A leading "-" sorts newest/last first, like everywhere in the API (api-conventions.md §7) */
export const EMPLOYEE_SORTS = [
  'code',
  '-code',
  'nameEn',
  '-nameEn',
  'nameAr',
  '-nameAr',
  'hireDate',
  '-hireDate',
] as const;
export type EmployeeSort = (typeof EMPLOYEE_SORTS)[number];

/** "active,suspended" → ['active', 'suspended'] (comma for several values) */
const commaList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string('badRequest')
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== ''),
    )
    .pipe(z.array(z.enum(values, 'badRequest')).min(1, 'badRequest'));

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** GET /employees?page=&pageSize=&q=&status=&employmentType=&jobTitleId=&sort= */
export const listEmployeesQuerySchema = z.object({
  page: z.coerce
    .number('badRequest')
    .int('badRequest')
    .min(1, 'badRequest')
    .default(1),
  pageSize: z.coerce
    .number('badRequest')
    .int('badRequest')
    .min(1, 'badRequest')
    .max(100, 'badRequest')
    .default(20),
  /** Name (Arabic or English), code, phone or national ID */
  q: z.preprocess(
    emptyToUndefined,
    z.string('badRequest').trim().max(100, 'badRequest').optional(),
  ),
  status: commaList(EMPLOYEE_STATUSES).optional(),
  employmentType: commaList(EMPLOYMENT_TYPES).optional(),
  jobTitleId: z.preprocess(emptyToUndefined, z.uuid('badRequest').optional()),
  sort: z.enum(EMPLOYEE_SORTS, 'badRequest').default('code'),
});

export type ListEmployeesQueryRequest = z.input<
  typeof listEmployeesQuerySchema
>;
export type ListEmployeesQuery = z.output<typeof listEmployeesQuerySchema>;

/** One row of the list: what the table shows, nothing more (no national ID, no contacts but phone) */
export interface EmployeeListItem {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  jobTitle: { id: string; nameAr: string; nameEn: string } | null;
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  status: EmployeeStatus;
  /** "2026-10-01" */
  hireDate: string;
  phone: string | null;
}

export interface EmployeeListPage {
  items: EmployeeListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * GET /employees/export?q=&status=&employmentType=&jobTitleId=&sort=&lang=
 * The same filters as the list, without pages: the file holds every matching employee.
 * lang picks the column titles and values (Arabic sheets read right to left).
 */
export const exportEmployeesQuerySchema = listEmployeesQuerySchema
  .omit({ page: true, pageSize: true })
  .extend({ lang: z.enum(['en', 'ar'], 'badRequest').default('en') });

export type ExportEmployeesQueryRequest = z.input<
  typeof exportEmployeesQuerySchema
>;
export type ExportEmployeesQuery = z.output<typeof exportEmployeesQuerySchema>;
