// The "guard": a Prisma extension that limits every query to the company on the badge
// (FND-03, NFR-1, D-25). Every query passes through $allOperations before it reaches the database.
import { Prisma } from '../../generated/prisma/client.js';
import { currentCompanyId } from './tenant-context.js';

// Tables that belong to a company (each has a companyId column).
// A unit test compares this list with schema.prisma, so a new table cannot be forgotten.
export const COMPANY_TABLES: string[] = [
  'CompanySettingsVersion',
  'User',
  'JobTitle',
  'Employee',
  'SalaryHistory',
  'EmployeeStatusHistory',
  'Document',
  'Contract',
];

// Query types that have a "where" (which rows to read, change or delete)
const OPERATIONS_WITH_WHERE: string[] = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
];

// Query types that create new rows (they have "data" instead of "where")
const OPERATIONS_THAT_CREATE: string[] = [
  'create',
  'createMany',
  'createManyAndReturn',
];

// On the companies table itself, a company may only read and update its own row
const COMPANY_ROW_OPERATIONS: string[] = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'update',
];

type Args = Record<string, unknown>;

/**
 * Adds "field = companyId" to a where.
 * If the code asked for another company, that condition is kept with AND,
 * so the query finds nothing instead of quietly switching to our company.
 */
function onlyThisCompany(
  where: unknown,
  field: string,
  companyId: string,
): Args {
  const result: Args = { ...((where as Args | undefined) ?? {}) };
  const asked = result[field];
  result[field] = companyId;
  if (asked !== undefined && asked !== companyId) {
    const existingAnd = result.AND === undefined ? [] : [result.AND].flat();
    result.AND = [...existingAnd, { [field]: asked }];
  }
  return result;
}

/** Checks a new row belongs to this company, and refuses it if it names another one. */
function checkNewRow(model: string, data: unknown, companyId: string): Args {
  const row: Args = { ...((data as Args | undefined) ?? {}) };
  if (row.companyId === undefined) {
    throw new Error(`New ${model} needs companyId: use requireCompanyId()`);
  }
  if (row.companyId !== companyId) {
    throw new Error(`Cannot write ${model} for another company`);
  }
  return row;
}

export const tenancyExtension = Prisma.defineExtension({
  name: 'tenancy',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const isCompaniesTable = model === 'Company';

        // 1. Not a company table: let it pass
        if (!isCompaniesTable && !COMPANY_TABLES.includes(model)) {
          return query(args);
        }

        // 2. Read the badge. No badge: stop
        const companyId = currentCompanyId();
        if (!companyId) {
          throw new Error(`No company context for ${model}.${operation}`);
        }

        const scoped: Args = { ...((args as Args | undefined) ?? {}) };

        // 3. The companies table: only your own company row, and no create or delete
        if (isCompaniesTable) {
          if (!COMPANY_ROW_OPERATIONS.includes(operation)) {
            throw new Error(`Cannot ${operation} companies here`);
          }
          scoped.where = onlyThisCompany(scoped.where, 'id', companyId);
          return query(scoped as typeof args);
        }

        // 4. Reads, updates and deletes: add "only this company" to the where
        if (OPERATIONS_WITH_WHERE.includes(operation)) {
          scoped.where = onlyThisCompany(scoped.where, 'companyId', companyId);
        }

        // 5. Creates: every new row must carry this company's id
        if (OPERATIONS_THAT_CREATE.includes(operation)) {
          scoped.data = Array.isArray(scoped.data)
            ? scoped.data.map((row) => checkNewRow(model, row, companyId))
            : checkNewRow(model, scoped.data, companyId);
        }
        if (operation === 'upsert') {
          scoped.create = checkNewRow(model, scoped.create, companyId);
        }

        // 6. Updates: a row cannot be moved to another company
        if (operation.startsWith('update') || operation === 'upsert') {
          const changes = (
            operation === 'upsert' ? scoped.update : scoped.data
          ) as Args | undefined;
          if (
            changes?.companyId !== undefined &&
            changes.companyId !== companyId
          ) {
            throw new Error(`Cannot write ${model} for another company`);
          }
        }

        // 7. Send the query to the database
        return query(scoped as typeof args);
      },
    },
  },
});
