import { z } from 'zod';
import { isoDateSchema, weekdaySchema } from '../settings/settings-versions.js';

const time = z
  .string('timeInvalid')
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'timeInvalid');
const minutes = z
  .int('minutesInvalid')
  .min(0, 'minutesInvalid')
  .max(1439, 'minutesInvalid');
export const shiftTemplateSchema = z
  .object({
    name: z.string('required').trim().min(1, 'required').max(100, 'tooLong'),
    startTime: time,
    endTime: time,
    crossesMidnight: z.boolean('badRequest'),
    breakMinutes: minutes,
    lateGraceMinutes: minutes,
    earlyLeaveGraceMinutes: minutes,
    workingDays: z
      .array(weekdaySchema)
      .min(1, 'workingDaysRequired')
      .max(7, 'dayInvalid')
      .refine((days) => new Set(days).size === days.length, 'dayInvalid'),
  })
  .strict()
  .superRefine((value, ctx) => {
    const count = (time: string) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    const start = count(value.startTime),
      end = count(value.endTime);
    if (value.crossesMidnight ? end >= start : end <= start)
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'shiftTimesInvalid',
      });
    const duration = end - start + (value.crossesMidnight ? 1440 : 0);
    if (value.breakMinutes >= duration)
      ctx.addIssue({
        code: 'custom',
        path: ['breakMinutes'],
        message: 'shiftBreakInvalid',
      });
    for (const field of ['lateGraceMinutes', 'earlyLeaveGraceMinutes'] as const)
      if (value[field] >= duration)
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'shiftGraceInvalid',
        });
  });
export const shiftAssignmentSchema = z
  .object({
    shiftTemplateId: z.uuid('invalidReference'),
    startDate: isoDateSchema,
  })
  .strict();
export type ShiftTemplateInput = z.output<typeof shiftTemplateSchema>;
export type ShiftAssignmentInput = z.output<typeof shiftAssignmentSchema>;
export interface ShiftTemplate extends ShiftTemplateInput {
  id: string;
}
export interface ShiftAssignment {
  id: string;
  startDate: string;
  shiftTemplate: ShiftTemplate;
}
export interface ShiftAssignments {
  date: string;
  current: ShiftAssignment | null;
  items: ShiftAssignment[];
}
