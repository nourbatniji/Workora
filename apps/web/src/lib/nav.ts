import {
  CalendarClock,
  CalendarOff,
  Clock,
  FileText,
  Inbox,
  LayoutGrid,
  Settings,
  ShieldCheck,
  UserRoundSearch,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/session';

export type NavKey =
  | 'dashboard'
  | 'employees'
  | 'recruitment'
  | 'shifts'
  | 'attendance'
  | 'exceptions'
  | 'leave'
  | 'contracts'
  | 'payroll'
  | 'compliance'
  | 'settings';

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** false = the page shows "coming in the next phase" */
  built: boolean;
  /** Who sees this item (requirements/permissions.md). The API still checks every request */
  roles: Role[];
};

const ALL: Role[] = ['admin', 'employee', 'interviewer'];

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/', icon: LayoutGrid, built: true, roles: ALL },
  {
    key: 'employees',
    href: '/employees',
    icon: Users,
    built: false,
    roles: ['admin'],
  },
  {
    key: 'recruitment',
    href: '/recruitment',
    icon: UserRoundSearch,
    built: false,
    roles: ['admin', 'interviewer'],
  },
  {
    key: 'shifts',
    href: '/shifts',
    icon: CalendarClock,
    built: false,
    roles: ['admin', 'employee'],
  },
  {
    key: 'attendance',
    href: '/attendance',
    icon: Clock,
    built: false,
    roles: ['admin', 'employee'],
  },
  {
    key: 'exceptions',
    href: '/exceptions',
    icon: Inbox,
    built: true,
    roles: ['admin', 'employee'],
  },
  {
    key: 'leave',
    href: '/leave',
    icon: CalendarOff,
    built: false,
    roles: ['admin', 'employee'],
  },
  {
    key: 'contracts',
    href: '/contracts',
    icon: FileText,
    built: false,
    roles: ['admin'],
  },
  {
    key: 'payroll',
    href: '/payroll',
    icon: Wallet,
    built: false,
    roles: ['admin', 'employee'],
  },
  {
    key: 'compliance',
    href: '/compliance',
    icon: ShieldCheck,
    built: false,
    roles: ['admin'],
  },
  {
    key: 'settings',
    href: '/settings',
    icon: Settings,
    built: false,
    roles: ['admin'],
  },
];

/** The menu for one role: Employees see only their own areas, Interviewers only recruitment */
export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Modules that render the "coming in the next phase" page */
export const SOON_MODULES = NAV_ITEMS.filter((item) => !item.built).map(
  (item) => item.key,
);

export type SavedViewKey = 'nightShift' | 'probationEnding' | 'trainees';

/** Saved views filter the employee list, so only Admins get them */

export const SAVED_VIEWS: { key: SavedViewKey; href: string; count: number }[] =
  [
    { key: 'nightShift', href: '/employees?view=night-shift', count: 9 },
    {
      key: 'probationEnding',
      href: '/employees?view=probation-ending',
      count: 3,
    },
    { key: 'trainees', href: '/employees?view=trainees', count: 4 },
  ];

/** Finds the nav item for a path such as "/exceptions" or "/employees/E-014" */
export function navItemForPath(pathname: string): NavItem | undefined {
  if (pathname === '/') return NAV_ITEMS[0];
  return NAV_ITEMS.find(
    (item) => item.href !== '/' && pathname.startsWith(item.href),
  );
}
