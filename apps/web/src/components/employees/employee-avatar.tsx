'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { EmployeeListItem } from '@mdarj/shared';
import { Avatar } from './person-bits';

/** Read-only list photo. Editing stays on the employee profile. */
export default function EmployeeAvatar({
  employee,
  name,
  locale,
}: {
  employee: Pick<EmployeeListItem, 'id' | 'code' | 'hasPhoto'>;
  name: string;
  locale: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!employee.hasPhoto) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const response = await fetch(`/api/employees/${employee.id}/photo`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Photo unavailable');
        const link: { url: string; expiresAt: string } = await response.json();
        if (controller.signal.aborted) return;
        setUrl(link.url);
        // Renew while this row is on the current page; cancel when it unmounts.
        timer = setTimeout(
          load,
          Math.max(1000, Date.parse(link.expiresAt) - Date.now() - 30000),
        );
      } catch {
        if (!controller.signal.aborted) setUrl(null);
      }
    }
    void load();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [employee.id, employee.hasPhoto]);

  return (
    <span
      aria-hidden
      className="relative inline-flex size-9 shrink-0 overflow-hidden rounded-full"
    >
      <Avatar name={name} code={employee.code} locale={locale} />
      {employee.hasPhoto && url && (
        <Image
          unoptimized
          src={url}
          width={36}
          height={36}
          alt=""
          className="absolute inset-0 size-9 rounded-full object-cover"
          onError={() => setUrl(null)}
        />
      )}
    </span>
  );
}
