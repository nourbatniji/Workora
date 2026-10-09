'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { useCurrentUser } from '@/components/shell/current-user';
import {
  INITIAL_EXCEPTIONS,
  recalculateCheckout,
  type AttendanceException,
  type LeaveTypeKey,
} from '@/mock/exceptions';

/**
 * Client-side store for the Exceptions inbox. Decisions live in memory only:
 * a page reload brings back the mock data. The real app will call the API instead.
 */
type ExceptionsStore = {
  exceptions: AttendanceException[];
  pendingCount: number;
  approve: (ids: string[], note?: string) => void;
  reject: (ids: string[], note?: string) => void;
  editAndApprove: (id: string, amount: number, note?: string) => void;
  convertToLeave: (id: string, leaveType: LeaveTypeKey, note?: string) => void;
  setCheckout: (id: string, time: string) => void;
  /** Puts a decided exception back to pending (the toast's Undo) */
  undo: (snapshot: AttendanceException[]) => void;
};

const Context = createContext<ExceptionsStore | null>(null);

export function ExceptionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [exceptions, setExceptions] = useState(INITIAL_EXCEPTIONS);
  // Decisions are signed by the real logged-in Admin, not a mock name (SCRUM-169)
  const user = useCurrentUser();
  const deciderName = user.name ?? user.email ?? '';

  const value = useMemo<ExceptionsStore>(() => {
    // Only pending exceptions can be decided; change() returns null to skip one
    // (e.g. a missing check-out has no amount until the real time is entered)
    const decide = (
      ids: string[],
      change: (e: AttendanceException) => Partial<AttendanceException> | null,
    ) =>
      setExceptions((list) =>
        list.map((e) => {
          if (!ids.includes(e.id) || e.status !== 'pending') return e;
          const patch = change(e);
          return patch
            ? {
                ...e,
                ...patch,
                decidedBy: { ar: deciderName, en: deciderName },
                decidedAt: new Date().toISOString(),
              }
            : e;
        }),
      );

    return {
      exceptions,
      pendingCount: exceptions.filter((e) => e.status === 'pending').length,
      approve: (ids, note) =>
        decide(ids, (e) =>
          e.suggestedAmount === null
            ? null
            : { status: 'approved', finalAmount: e.suggestedAmount, note },
        ),
      reject: (ids, note) =>
        decide(ids, () => ({ status: 'rejected', finalAmount: 0, note })),
      editAndApprove: (id, amount, note) =>
        decide([id], () => ({ status: 'approved', finalAmount: amount, note })),
      convertToLeave: (id, leaveType, note) =>
        decide([id], () => ({
          status: 'converted',
          leaveType,
          finalAmount: 0,
          note,
        })),
      setCheckout: (id, time) =>
        setExceptions((list) =>
          list.map((e) => (e.id === id ? recalculateCheckout(e, time) : e)),
        ),
      undo: (snapshot) =>
        setExceptions((list) =>
          list.map((e) => snapshot.find((s) => s.id === e.id) ?? e),
        ),
    };
  }, [exceptions, deciderName]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useExceptions() {
  const value = useContext(Context);
  if (!value)
    throw new Error('useExceptions must be used inside <ExceptionsProvider>');
  return value;
}
