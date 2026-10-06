'use client';

import {
  Bookmark,
  CornerDownLeft,
  Languages,
  Moon,
  Scale,
  Search,
  Sun,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { NAV_ITEMS, SAVED_VIEWS } from '@/lib/nav';
import Modal from '@/components/ui/modal';
import { useAppState } from './app-state';

type Command = {
  id: string;
  group: 'pages' | 'savedViews' | 'actions';
  label: string;
  icon: LucideIcon;
  soon?: boolean;
  run: () => void;
};

/** Cmd/Ctrl+K: jump to any page, saved view or action by typing */
export default function CommandPalette() {
  const { overlay, close } = useAppState();
  const t = useTranslations('Palette');
  // Re-mount on every open so the search box starts empty
  return (
    <Modal
      open={overlay === 'palette'}
      onClose={close}
      title={t('label')}
      closeLabel={t('hintClose')}
      bare
      position="top"
      className="max-w-xl"
    >
      <PaletteBody />
    </Modal>
  );
}

function PaletteBody() {
  const t = useTranslations('Palette');
  const tNav = useTranslations('Nav');
  const tViews = useTranslations('SavedViews');
  const tShell = useTranslations('Shell');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { close, open, theme, toggleTheme } = useAppState();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    return [
      ...NAV_ITEMS.map((item) => ({
        id: `page-${item.key}`,
        group: 'pages' as const,
        label: tNav(item.key),
        icon: item.icon,
        soon: !item.built,
        run: go(item.href),
      })),
      ...SAVED_VIEWS.map((view) => ({
        id: `view-${view.key}`,
        group: 'savedViews' as const,
        label: tViews(view.key),
        icon: Bookmark,
        run: go(view.href),
      })),
      {
        id: 'invite',
        group: 'actions',
        label: t('actionInvite'),
        icon: UserPlus,
        run: () => open('invite'),
      },
      {
        id: 'theme',
        group: 'actions',
        label: theme === 'dark' ? t('actionThemeLight') : t('actionThemeDark'),
        icon: theme === 'dark' ? Sun : Moon,
        run: () => {
          toggleTheme();
          close();
        },
      },
      {
        id: 'language',
        group: 'actions',
        label: t('actionLanguage'),
        icon: Languages,
        run: () => {
          close();
          router.replace(pathname, { locale: locale === 'ar' ? 'en' : 'ar' });
        },
      },
      {
        id: 'lawRef',
        group: 'actions',
        label: t('actionLawRef'),
        icon: Scale,
        run: () => open('lawRef'),
      },
    ];
  }, [
    t,
    tNav,
    tViews,
    theme,
    locale,
    pathname,
    router,
    close,
    open,
    toggleTheme,
  ]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next =
        (safeIndex + step + results.length) % Math.max(results.length, 1);
      setActiveIndex(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter' && results[safeIndex]) {
      event.preventDefault();
      results[safeIndex].run();
    }
  }

  const groups: Command['group'][] = ['pages', 'savedViews', 'actions'];

  return (
    <div onKeyDown={onKeyDown}>
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search
          className="size-[18px] shrink-0 text-muted"
          strokeWidth={1.5}
          aria-hidden
        />
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={
            results[safeIndex] ? `cmd-${results[safeIndex].id}` : undefined
          }
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
        />
      </div>

      <ul
        id="palette-results"
        ref={listRef}
        role="listbox"
        className="thin-scroll max-h-[min(24rem,60vh)] overflow-y-auto p-2"
      >
        {results.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted">
            {t('noResults', { query })}
          </li>
        )}
        {groups.map((group) => {
          const items = results.filter((c) => c.group === group);
          if (items.length === 0) return null;
          return (
            <li key={group} role="presentation">
              <p className="px-3 pt-2 pb-1 text-xs text-muted">{t(group)}</p>
              <ul role="presentation">
                {items.map((command) => {
                  const index = results.indexOf(command);
                  const isActive = index === safeIndex;
                  const Icon = command.icon;
                  return (
                    <li
                      key={command.id}
                      id={`cmd-${command.id}`}
                      role="option"
                      aria-selected={isActive}
                      data-index={index}
                      onMouseMove={() => setActiveIndex(index)}
                      onClick={command.run}
                      className={`flex h-10 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-sm ${
                        isActive
                          ? 'bg-nav-selected text-accent-fg'
                          : 'text-text'
                      }`}
                    >
                      <Icon
                        className="size-[18px] shrink-0"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <span className="flex-1 truncate">{command.label}</span>
                      {command.soon && (
                        <span className="rounded-full bg-canvas px-2 text-[11px] leading-5 text-muted">
                          {tShell('nextPhase')}
                        </span>
                      )}
                      {isActive && (
                        <CornerDownLeft
                          className="size-4 shrink-0 rtl:-scale-x-100"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-muted">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> {t('hintMove')}
        </span>
        <span>
          <Kbd>Enter</Kbd> {t('hintOpen')}
        </span>
        <span>
          <Kbd>Esc</Kbd> {t('hintClose')}
        </span>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      dir="ltr"
      className="rounded-md border border-line bg-canvas px-1.5 font-sans text-[11px]"
    >
      {children}
    </kbd>
  );
}
