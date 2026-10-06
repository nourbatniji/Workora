// Mock numbers for the Admin dashboard (FR-DB-1). Chosen to agree with each other:
// 36 people were due so far today: 31 came (26 on time, 5 late), 2 absent, 3 on leave → 31 / 36 = 86%.

export const today = {
  date: '2026-10-05',
  due: 36,
  onTime: 26,
  late: 5,
  absent: 2,
  onLeave: 3,
  /** Tonight's night shift (22:00) hasn't started yet */
  notYetIn: 9,
  /** Where the late and absent people came from */
  byShift: { night: 5, morning: 1, evening: 1 },
};

export const attendanceRate = Math.round(
  ((today.onTime + today.late) / today.due) * 100,
);

/** Late arrivals per day for the last 7 days, oldest first. null = weekly rest day (Friday) */
export const lateArrivals: {
  date: string;
  thisWeek: number | null;
  lastWeek: number | null;
}[] = [
  { date: '2026-09-29', thisWeek: 4, lastWeek: 3 },
  { date: '2026-09-30', thisWeek: 3, lastWeek: 4 },
  { date: '2026-10-01', thisWeek: 6, lastWeek: 3 },
  { date: '2026-10-02', thisWeek: null, lastWeek: null },
  { date: '2026-10-03', thisWeek: 2, lastWeek: 5 },
  { date: '2026-10-04', thisWeek: 4, lastWeek: 2 },
  { date: '2026-10-05', thisWeek: 5, lastWeek: 4 },
];

export const pendingLeaveRequests = 3;

/** FR-CT-4 */
export const contracts = { expiringSoon: 2, expired: 1, active: 39 };
