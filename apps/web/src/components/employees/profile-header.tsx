'use client';

import type { EmployeeProfile } from '@mdarj/shared';
import { useState } from 'react';
import Modal from '@/components/ui/modal';
import { useRouter } from '@/i18n/navigation';
import type { ApiError } from '@/lib/api';
import { History } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import AppAccessButton from './app-access-button';
import { useTenure } from './person-bits';
import ProfilePhoto from './profile-photo';
import styles from './profile.module.css';

const STATUS_STYLE: Record<EmployeeProfile['status'], string> = {
  active: 'bg-success/10 text-text',
  suspended: 'bg-warning/15 text-text',
  terminated: 'bg-canvas text-muted',
};
const STATUS_DOT: Record<EmployeeProfile['status'], string> = {
  active: 'bg-success',
  suspended: 'bg-warning',
  terminated: 'bg-muted',
};

/** The top of the profile: who this is, their job and status, and the actions on them */
export default function ProfileHeader({
  employee,
  hireDateText,
  referenceTime,
}: {
  employee: EmployeeProfile;
  hireDateText: string;
  referenceTime: number;
}) {
  const t = useTranslations('Employees');
  const removeText = useTranslations('Employees.removal');
  const errors = useTranslations('Errors');
  const router = useRouter();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  async function removeEmployee() {
    if (removing) return;
    setRemoving(true);
    setRemoveError('');
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data: ApiError | null = await response.json().catch(() => null);
        setRemoveError(data?.message ?? 'somethingWrong');
        return;
      }
      router.replace('/employees');
      router.refresh();
    } catch {
      setRemoveError('somethingWrong');
    } finally {
      setRemoving(false);
    }
  }
  const locale = useLocale();
  const tenure = useTenure(referenceTime);
  const name = locale === 'ar' ? employee.nameAr : employee.nameEn;
  const otherName = locale === 'ar' ? employee.nameEn : employee.nameAr;
  const title = employee.jobTitle
    ? locale === 'ar'
      ? employee.jobTitle.nameAr
      : employee.jobTitle.nameEn
    : null;

  return (
    <Card>
      <div className={styles.header}>
        <div className={`${styles.identity} flex-1`}>
          <ProfilePhoto key={employee.id} employee={employee} />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{name}</h1>
            <p className="truncate text-sm text-muted">{otherName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-canvas px-2 py-0.5" dir="ltr">
                {employee.code}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${STATUS_STYLE[employee.status]}`}
              >
                <span
                  className={`size-1.5 rounded-full ${STATUS_DOT[employee.status]}`}
                  aria-hidden
                />
                {t(`status.${employee.status}`)}
              </span>
              <span className="rounded-full bg-canvas px-2 py-0.5">
                {t(`types.${employee.employmentType}`)}
              </span>
              {title && (
                <span className="rounded-full bg-canvas px-2 py-0.5">
                  {title}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              {t('profile.since', {
                date: hireDateText,
                tenure: tenure(employee.hireDate),
              })}
            </p>
          </div>
        </div>

        <div className={styles.actions}>
          <AppAccessButton employee={employee} />
          <button
            type="button"
            onClick={() => {
              setRemoveError('');
              setConfirmRemove(true);
            }}
            className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-[13px] text-danger hover:bg-canvas"
          >
            {removeText('button')}
          </button>
          <Link
            href={`/audit-log?employeeId=${employee.id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] whitespace-nowrap hover:bg-canvas"
          >
            <History className="size-3.5" strokeWidth={1.5} aria-hidden />
            {t('profile.history')}
          </Link>
        </div>
      </div>
      <Modal
        open={confirmRemove}
        onClose={() => {
          if (!removing) setConfirmRemove(false);
        }}
        title={removeText('title')}
        description={removeText('description', { name })}
        closeLabel={removeText('cancel')}
      >
        {removeError && (
          <p role="alert" className="mb-4 text-sm text-danger">
            {errors(errors.has(removeError) ? removeError : 'somethingWrong')}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={removing}
            onClick={() => setConfirmRemove(false)}
            className="h-9 rounded-lg border border-line px-3 text-sm"
          >
            {removeText('cancel')}
          </button>
          <button
            type="button"
            disabled={removing}
            onClick={removeEmployee}
            className="h-9 rounded-lg bg-danger px-3 text-sm text-white disabled:opacity-60"
          >
            {removeText(removing ? 'removing' : 'confirm')}
          </button>
        </div>
      </Modal>
    </Card>
  );
}
