import { salaryChangeSchema, shiftTemplateSchema } from '@mdarj/shared';
describe('Job field business rules', () => {
  const shift = {
    name: 'Night',
    startTime: '22:00',
    endTime: '06:00',
    crossesMidnight: true,
    breakMinutes: 30,
    lateGraceMinutes: 15,
    earlyLeaveGraceMinutes: 0,
    workingDays: [0, 1, 2, 3, 4],
  };
  it('accepts a night shift and a no-break day shift', () => {
    expect(shiftTemplateSchema.safeParse(shift).success).toBe(true);
    expect(
      shiftTemplateSchema.safeParse({
        ...shift,
        startTime: '09:00',
        endTime: '17:00',
        crossesMidnight: false,
        breakMinutes: 0,
      }).success,
    ).toBe(true);
  });
  it('requires an explicit overnight flag and refuses zero/24-hour shifts', () => {
    expect(
      shiftTemplateSchema.safeParse({ ...shift, crossesMidnight: false })
        .success,
    ).toBe(false);
    expect(
      shiftTemplateSchema.safeParse({ ...shift, endTime: '22:00' }).success,
    ).toBe(false);
  });
  it('requires positive paid duration and shorter grace than the shift', () => {
    expect(
      shiftTemplateSchema.safeParse({ ...shift, breakMinutes: 480 }).success,
    ).toBe(false);
    expect(
      shiftTemplateSchema.safeParse({ ...shift, lateGraceMinutes: 480 })
        .success,
    ).toBe(false);
  });
  it('allows the maximum exact salary and zero, but rejects excess precision', () => {
    expect(
      salaryChangeSchema.safeParse({
        baseSalary: '9999999999.99',
        effectiveFrom: '2026-01-01',
      }).success,
    ).toBe(true);
    expect(
      salaryChangeSchema.safeParse({
        baseSalary: '0',
        effectiveFrom: '2026-01-01',
      }).success,
    ).toBe(true);
    expect(
      salaryChangeSchema.safeParse({
        baseSalary: '1.001',
        effectiveFrom: '2026-01-01',
      }).success,
    ).toBe(false);
  });
});
