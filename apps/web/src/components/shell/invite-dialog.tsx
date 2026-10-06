'use client';

import { Check, Copy, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field, inputClass } from '@/components/ui/field';
import Modal from '@/components/ui/modal';
import { useAppState } from './app-state';

/** FR-UA-1 / FR-UA-2 preview: create an invite link, valid 7 days, copy it to share by WhatsApp or SMS */
export default function InviteDialog() {
  const t = useTranslations('Invite');
  const tShell = useTranslations('Shell');
  const { overlay, close } = useAppState();

  return (
    <Modal
      open={overlay === 'invite'}
      onClose={close}
      title={t('title')}
      description={t('description')}
      closeLabel={tShell('close')}
    >
      <InviteForm onDone={close} />
    </Modal>
  );
}

type Errors = Partial<Record<'name' | 'contact' | 'phone' | 'email', string>>;

function InviteForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations('Invite');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = t('nameRequired');
    if (!phone.trim() && !email.trim()) next.contact = t('contactRequired');
    if (phone.trim() && !/^01[0125]\d{8}$/.test(phone.trim()))
      next.phone = t('phoneInvalid');
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = t('emailInvalid');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    // Mock token: the real one comes from the API (users.invite_token)
    const token = Math.random().toString(36).slice(2, 10);
    setLink(`https://mdarj.example/invite/${token}`);
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard blocked: the link is still selectable in the box
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function reset() {
    setName('');
    setPhone('');
    setEmail('');
    setErrors({});
    setLink(null);
  }

  if (link) {
    return (
      <div>
        <p className="text-sm font-medium">
          {t('readyTitle', { name: name.trim() })}
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-line bg-canvas p-2 ps-3">
          <Link2
            className="size-4 shrink-0 text-muted"
            strokeWidth={1.5}
            aria-hidden
          />
          <input
            readOnly
            value={link}
            dir="ltr"
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            aria-label={t('copy')}
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-white"
          >
            {copied ? (
              <Check className="size-4" strokeWidth={1.5} aria-hidden />
            ) : (
              <Copy className="size-4" strokeWidth={1.5} aria-hidden />
            )}
            {copied ? t('copied') : t('copy')}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">{t('readyHint')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={reset}
            className="h-9 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas"
          >
            {t('another')}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white"
          >
            {t('done')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label={t('name')} error={errors.name}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          className={inputClass(!!errors.name)}
          autoFocus
        />
      </Field>
      <Field label={t('phone')} error={errors.phone}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('phonePlaceholder')}
          inputMode="tel"
          dir="ltr"
          className={`${inputClass(!!errors.phone || !!errors.contact)} rtl:text-end`}
        />
      </Field>
      <Field
        label={t('email')}
        hint={t('optional')}
        error={errors.email ?? errors.contact}
      >
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          type="email"
          dir="ltr"
          className={`${inputClass(!!errors.email || !!errors.contact)} rtl:text-end`}
        />
      </Field>
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="h-9 rounded-[10px] border border-line px-3.5 text-sm hover:bg-canvas"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          className="h-9 rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white"
        >
          {t('submit')}
        </button>
      </div>
    </form>
  );
}
