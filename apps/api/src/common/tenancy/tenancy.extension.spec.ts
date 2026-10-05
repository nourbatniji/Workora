import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMPANY_TABLES } from './tenancy.extension.js';

// Reads schema.prisma and lists every model that has a companyId field.
function modelsWithCompanyId(): string[] {
  const schema = readFileSync(
    join(process.cwd(), 'prisma/schema.prisma'),
    'utf8',
  );
  const models: string[] = [];
  for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    if (/^\s+companyId\s/m.test(match[2])) {
      models.push(match[1]);
    }
  }
  return models.sort();
}

describe('tenancy guard', () => {
  it('protects every table that has a companyId column', () => {
    // A new table with companyId must be added to COMPANY_TABLES, or this test fails.
    expect([...COMPANY_TABLES].sort()).toEqual(modelsWithCompanyId());
  });
});
