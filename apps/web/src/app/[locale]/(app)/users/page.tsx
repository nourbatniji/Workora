import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardHeader } from '@/components/ui/card';
import InviteButton from '@/components/users/invite-button';
import UsersTable, { type UserRow } from '@/components/users/users-table';
import { serverGet } from '@/lib/server-api';
import { getSession } from '@/lib/session';

type UsersList = {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Users and invites (SCRUM-150, UA-01, UA-02): everyone who can log in, with role and account
 * status, and a new link per person. Admin only: other roles get "not found", and the API refuses them too.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session.user || session.user.role !== 'admin') notFound();

  const t = await getTranslations('Users');
  const { page } = await searchParams;
  const asked = Number(typeof page === 'string' ? page : 1);
  const current = Number.isInteger(asked) && asked > 0 ? asked : 1;
  const list = await serverGet<UsersList>(`/users?page=${current}`);

  return (
    <Card>
      <CardHeader
        title={t('title')}
        hint={t('hint', { company: session.user.company.name })}
        action={<InviteButton />}
      />
      <UsersTable
        items={list.items}
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
      />
    </Card>
  );
}
