// Mock data for the app shell (UI prototype — awaiting backend integration).
// The user and company now come from the API (SCRUM-169); payroll progress and
// notifications stay mock until their own features are built.

export const payrollProgress = {
  month: '2026-10-01',
  status: 'draft' as const,
  stepsDone: 3,
  stepsTotal: 5,
};

export type NotificationType =
  | 'leaveRequested'
  | 'exceptionCreated'
  | 'contractExpiring'
  | 'payslipReady'
  | 'leaveDecided';

export type MockNotification = {
  id: string;
  type: NotificationType;
  /** Values inserted into the dictionary sentence */
  params: Record<string, string | number>;
  minutesAgo: number;
  read: boolean;
};

export const notifications: MockNotification[] = [
  {
    id: 'n1',
    type: 'exceptionCreated',
    params: { count: 7 },
    minutesAgo: 12,
    read: false,
  },
  {
    id: 'n2',
    type: 'leaveRequested',
    params: { name: 'mona' },
    minutesAgo: 48,
    read: false,
  },
  {
    id: 'n3',
    type: 'contractExpiring',
    params: { name: 'karim', days: 18 },
    minutesAgo: 180,
    read: false,
  },
  {
    id: 'n4',
    type: 'leaveDecided',
    params: { name: 'hany' },
    minutesAgo: 1440,
    read: true,
  },
  {
    id: 'n5',
    type: 'payslipReady',
    params: { month: 'september' },
    minutesAgo: 4320,
    read: true,
  },
];
