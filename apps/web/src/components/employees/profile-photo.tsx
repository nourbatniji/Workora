'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MAX_FILE_BYTES, type EmployeeProfile } from '@mdarj/shared';
import { useRouter } from '@/i18n/navigation';
import { Avatar } from './person-bits';
import styles from './profile.module.css';

type PhotoLink = { url: string; expiresAt: string };

export default function ProfilePhoto({
  employee,
}: {
  employee: EmployeeProfile;
}) {
  const t = useTranslations('Employees.photo');
  const tErr = useTranslations('Errors');
  const locale = useLocale();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [hasPhoto, setHasPhoto] = useState(employee.hasPhoto);
  const [photo, setPhoto] = useState<PhotoLink | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = locale === 'ar' ? employee.nameAr : employee.nameEn;

  useEffect(() => {
    if (!hasPhoto) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/employees/${employee.id}/photo`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('photoLoadFailed');
        const link: PhotoLink = await response.json();
        if (cancelled) return;
        setPhoto(link);
        timer = setTimeout(
          load,
          Math.max(1000, Date.parse(link.expiresAt) - Date.now() - 30000),
        );
      } catch {
        if (!cancelled) {
          setPhoto(null);
          setError('photoLoadFailed');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [employee.id, hasPhoto, revision]);

  async function change(file?: File) {
    if (!file) return;
    setSaved(false);
    setError(null);
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size === 0) {
      setError('photoInvalid');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('fileTooLarge');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`/api/employees/${employee.id}/photo`, {
        method: 'POST',
        body,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setError(error?.errors?.file ?? error?.message ?? 'somethingWrong');
        return;
      }
      setHasPhoto(true);
      setRevision((current) => current + 1);
      setSaved(true);
      router.refresh();
    } catch {
      setError('somethingWrong');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/employees/${employee.id}/photo`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setError(error?.message ?? 'somethingWrong');
        return;
      }
      setHasPhoto(false);
      setPhoto(null);
      setSaved(true);
      router.refresh();
    } catch {
      setError('somethingWrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.photoControl}>
      {photo ? (
        <Image
          unoptimized
          src={photo.url}
          width={64}
          height={64}
          alt={t('alt', { name })}
          className={styles.photo}
          onError={() => {
            setPhoto(null);
            setError('photoLoadFailed');
          }}
        />
      ) : (
        <Avatar name={name} code={employee.code} locale={locale} size="lg" />
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png"
        hidden
        onChange={(event) => {
          void change(event.target.files?.[0]);
          event.target.value = '';
        }}
        aria-label={t('choose')}
      />
      <button
        type="button"
        disabled={busy}
        className={styles.photoButton}
        onClick={() => input.current?.click()}
      >
        {busy ? t('saving') : hasPhoto ? t('change') : t('add')}
      </button>
      {hasPhoto && (
        <button
          type="button"
          disabled={busy}
          className={styles.photoButton}
          onClick={() => void remove()}
        >
          {t('remove')}
        </button>
      )}
      <span className={styles.photoHint}>{t('hint')}</span>
      {saved && (
        <span role="status" className={styles.photoHint}>
          {t('saved')}
        </span>
      )}
      {error && (
        <div role="alert" className={styles.photoError}>
          {tErr(error)}
          {error === 'photoLoadFailed' && (
            <button
              type="button"
              className={styles.photoButton}
              onClick={() => {
                setError(null);
                setRevision((current) => current + 1);
              }}
            >
              {t('retry')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
