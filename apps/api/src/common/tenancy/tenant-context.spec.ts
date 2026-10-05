import {
  currentCompanyId,
  requireCompanyId,
  runInCompany,
} from './tenant-context.js';

describe('tenant context', () => {
  it('has no company outside runInCompany', () => {
    expect(currentCompanyId()).toBeUndefined();
  });

  it('returns the company inside runInCompany', async () => {
    await runInCompany('company-a', async () => {
      expect(currentCompanyId()).toBe('company-a');
    });
  });

  it('keeps the company after an await inside runInCompany', async () => {
    await runInCompany('company-a', async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(currentCompanyId()).toBe('company-a');
    });
  });

  it('keeps two companies apart when they run at the same time', async () => {
    const seen = await Promise.all([
      runInCompany('company-a', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return currentCompanyId();
      }),
      runInCompany('company-b', async () => currentCompanyId()),
    ]);
    expect(seen).toEqual(['company-a', 'company-b']);
  });

  it('requireCompanyId throws when there is no company', () => {
    expect(() => requireCompanyId()).toThrow('No company context');
  });

  it('requireCompanyId returns the company inside runInCompany', async () => {
    await runInCompany('company-a', async () => {
      expect(requireCompanyId()).toBe('company-a');
    });
  });
});
