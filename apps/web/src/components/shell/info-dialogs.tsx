'use client';

import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import { useAppState } from './app-state';

const LAW_RULES = ['eg01', 'eg02', 'eg03', 'eg04', 'eg05', 'eg13'] as const;

/** The labor-law reference link in the sidebar opens this (SRS Appendix A, EG-LABOR v1) */
export function LawRefDialog() {
  const t = useTranslations('LawRef');
  const tShell = useTranslations('Shell');
  const { overlay, close } = useAppState();

  return (
    <Modal
      open={overlay === 'lawRef'}
      onClose={close}
      title={t('title')}
      description={t('description')}
      closeLabel={tShell('close')}
    >
      <dl className="divide-y divide-line rounded-[10px] border border-line">
        {LAW_RULES.map((code) => (
          <div
            key={code}
            className="grid grid-cols-[4.5rem_1fr] gap-3 px-3 py-2.5"
          >
            <dt className="text-xs text-muted tabular-nums" dir="ltr">
              {code.toUpperCase().replace('EG', 'EG-')}
            </dt>
            <dd>
              <span className="block text-[13px] font-medium">{t(code)}</span>
              <span className="block text-[13px] text-muted">
                {t(`${code}Value`)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">{t('guidance')}</p>
    </Modal>
  );
}

/** The help button on the rail */
export function HelpDialog() {
  const t = useTranslations('Help');
  const tShell = useTranslations('Shell');
  const { overlay, close } = useAppState();

  return (
    <Modal
      open={overlay === 'help'}
      onClose={close}
      title={t('title')}
      closeLabel={tShell('close')}
    >
      <ul className="flex flex-col gap-3 text-sm">
        <li>{t('tip1')}</li>
        <li>{t('tip2')}</li>
        <li>{t('tip3')}</li>
      </ul>
    </Modal>
  );
}
