'use client';

import { Check, Copy, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * An invite link with a Copy button (FR-UA-2): HR can always share it by WhatsApp or SMS.
 * Below it: whether MDARJ also emailed it.
 */
export default function InviteLinkBox({
  link,
  emailedTo,
}: {
  link: string;
  /** The address it was emailed to, or null when it wasn't (no email, or the email failed) */
  emailedTo: string | null;
}) {
  const t = useTranslations('Invite');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard blocked: the link is still selectable in the box
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-[10px] border border-line bg-canvas p-2 ps-3">
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
      <p className="mt-1 text-xs text-muted">
        {emailedTo ? t('emailSent', { email: emailedTo }) : t('noEmail')}
      </p>
    </div>
  );
}
