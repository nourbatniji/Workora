'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import Modal from '@/components/ui/modal';
import { Link, useRouter } from '@/i18n/navigation';
import { postJson } from '@/lib/api';
import InviteLinkBox from './invite-link-box';

/** One row of GET /users */
export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'employee' | 'interviewer';
  status: 'invited' | 'active' | 'deactivated';
  language: string;
  inviteExpiresAt: string | null;
  createdAt: string;
};

const STATUS_STYLE: Record<UserRow['status'], string> = {
  invited: 'bg-nav-selected text-accent-fg',
  active: 'bg-success/10 text-text',
  deactivated: 'bg-canvas text-muted',
};

/** The company's logins with role and account status (FR-UA-8), and a "New link" action per person (UA-02) */
export default function UsersTable({
  items,
  page,
  pageSize,
  total,
}: {
  items: UserRow[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const t = useTranslations('Users');
  const format = useFormatter();
  const [now] = useState(() => Date.now());

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{t('empty')}</p>;
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      {/* Phones: the table scrolls inside its own box, the page doesn't (NFR-7) */}
      <div className="-mx-5 overflow-x-auto md:-mx-6">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-start text-xs text-muted">
              <th className="px-5 py-2 text-start font-medium md:px-6">
                {t('columns.name')}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t('columns.role')}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t('columns.status')}
              </th>
              <th className="px-3 py-2 text-start font-medium">
                {t('columns.link')}
              </th>
              <th className="px-5 py-2 md:px-6">
                <span className="sr-only">{t('columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => {
              const expires = user.inviteExpiresAt
                ? new Date(user.inviteExpiresAt)
                : null;
              const expired = expires !== null && expires.getTime() <= now;
              return (
                <tr
                  key={user.id}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-5 py-3 md:px-6">
                    <p className="font-medium">{user.name ?? '—'}</p>
                    <p className="text-xs text-muted" dir="ltr">
                      {user.email ?? user.phone ?? '—'}
                    </p>
                  </td>
                  <td className="px-3 py-3">{t(`roles.${user.role}`)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_STYLE[user.status]}`}
                    >
                      {t(`status.${user.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap">
                    {expires === null ? (
                      <span className="text-muted">—</span>
                    ) : expired ? (
                      <span className="text-danger">{t('linkExpired')}</span>
                    ) : (
                      <span className="text-muted">
                        {t('linkValidUntil', {
                          date: format.dateTime(expires, {
                            day: 'numeric',
                            month: 'short',
                          }),
                        })}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-end md:px-6">
                    {user.status !== 'deactivated' && (
                      <NewLinkButton user={user} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav
          className="mt-4 flex items-center justify-between gap-3 text-sm"
          aria-label={t('pagination')}
        >
          <span className="text-muted">{t('pageOf', { page, pages })}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/users?page=${page - 1}`}
                className="h-9 rounded-[10px] border border-line px-3.5 leading-9 hover:bg-canvas"
              >
                {t('previous')}
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/users?page=${page + 1}`}
                className="h-9 rounded-[10px] border border-line px-3.5 leading-9 hover:bg-canvas"
              >
                {t('next')}
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}

/** POST /users/:id/invite: a fresh 7-day link; the old one stops working */
function NewLinkButton({ user }: { user: UserRow }) {
  const t = useTranslations('Users');
  const tErr = useTranslations('Errors');
  const tShell = useTranslations('Shell');
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    { link: string; emailedTo: string | null } | { error: string } | null
  >(null);

  async function issue() {
    setSending(true);
    const { status, data } = await postJson<{
      inviteLink?: string;
      emailSent?: boolean;
      message?: string;
    }>(`/users/${user.id}/invite`);
    setSending(false);

    if (status === 200 && data?.inviteLink) {
      setResult({
        link: data.inviteLink,
        emailedTo: data.emailSent ? user.email : null,
      });
      router.refresh(); // the new expiry date shows in the table
      return;
    }
    const key = data?.message ?? '';
    setResult({
      error: ['accountDeactivated', 'forbidden', 'notFound'].includes(key)
        ? key
        : 'somethingWrong',
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={issue}
        disabled={sending}
        className="h-8 rounded-lg border border-line px-3 text-[13px] whitespace-nowrap hover:bg-canvas disabled:opacity-60"
      >
        {sending ? t('sending') : t('newLink')}
      </button>
      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        title={t('newLinkTitle', { name: user.name ?? '' })}
        description={
          result && 'link' in result
            ? user.status === 'active'
              ? t('newLinkActive')
              : t('newLinkInvited')
            : undefined
        }
        closeLabel={tShell('close')}
      >
        {result && 'link' in result && (
          <InviteLinkBox link={result.link} emailedTo={result.emailedTo} />
        )}
        {result && 'error' in result && (
          <p role="alert" className="text-sm text-danger">
            {tErr(result.error)}
          </p>
        )}
      </Modal>
    </>
  );
}
