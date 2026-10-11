'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { USER_ROLES } from '@mdarj/shared';
import { Field, inputClass } from '@/components/ui/field';
import Modal from '@/components/ui/modal';
import { useRouter } from '@/i18n/navigation';
import type { UserRow } from './users-table';

type Role = (typeof USER_ROLES)[number];

/** Sends a JSON request through the /api proxy; never throws (no connection → status 0) */
async function send(method: 'PATCH' | 'POST', path: string, body?: unknown) {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

// Answers that get their own message; anything else is "something went wrong"
const KNOWN_ERRORS = ['lastActiveAdmin', 'conflict', 'forbidden', 'notFound'];

/**
 * Manage one login (UA-07, UA-10): change the role, switch the login off or back on.
 * The API refuses anything that would leave the company without an Active Admin (FR-UA-9).
 */
export default function ManageUserButton({ user }: { user: UserRow }) {
  const t = useTranslations('Users');
  const tErr = useTranslations('Errors');
  const tShell = useTranslations('Shell');
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(user.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run(method: 'PATCH' | 'POST', path: string, body?: unknown) {
    setBusy(true);
    setError(undefined);
    const { status, data } = await send(method, path, body);
    setBusy(false);
    if (status === 200) {
      setOpen(false);
      router.refresh(); // the table shows the new role or status
      return;
    }
    const key = data?.message ?? '';
    setError(KNOWN_ERRORS.includes(key) ? key : 'somethingWrong');
  }

  const off = user.status === 'deactivated';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRole(user.role);
          setError(undefined);
          setOpen(true);
        }}
        className="h-8 rounded-lg border border-line px-3 text-[13px] whitespace-nowrap hover:bg-canvas"
      >
        {t('manage')}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('manageTitle', { name: user.name ?? '' })}
        closeLabel={tShell('close')}
      >
        <div className="flex flex-col gap-5">
          {/* Role */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label={t('columns.role')}>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className={inputClass(false)}
                >
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              type="button"
              disabled={busy || role === user.role}
              onClick={() => run('PATCH', `/users/${user.id}`, { role })}
              className="h-10 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {t('saveRole')}
            </button>
          </div>

          {/* Login on / off */}
          <div className="rounded-[10px] border border-line p-3">
            <p className="text-[13px] font-medium">{t('loginTitle')}</p>
            <p className="mt-1 text-xs text-muted">
              {off ? t('switchOnHint') : t('switchOffHint')}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  'POST',
                  `/users/${user.id}/${off ? 'activate' : 'deactivate'}`,
                )
              }
              className={`mt-3 h-9 rounded-[10px] border px-3.5 text-sm disabled:opacity-60 ${
                off
                  ? 'border-line hover:bg-canvas'
                  : 'border-danger/40 text-danger hover:bg-danger/5'
              }`}
            >
              {off ? t('switchOn') : t('switchOff')}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-[10px] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
            >
              {tErr(error)}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
