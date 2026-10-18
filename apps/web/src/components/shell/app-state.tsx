'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useState,
} from 'react';
import { useLocale } from 'next-intl';

export type Theme = 'light' | 'dark';
export type Overlay = 'palette' | 'invite' | 'lawRef' | 'help' | 'menu' | null;

type AppState = {
  theme: Theme;
  toggleTheme: () => void;
  overlay: Overlay;
  open: (overlay: Exclude<Overlay, null>) => void;
  close: () => void;
};

const AppStateContext = createContext<AppState | null>(null);

export const THEME_STORAGE_KEY = 'mdarj-theme';

/**
 * Runs in <head> before the page paints, so a dark-mode user never sees a white flash.
 * Kept as a string because it must run before React loads.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`;

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [overlay, setOverlay] = useState<Overlay>(null);

  const locale = useLocale();

  // Locale navigation can replace the document root without running its inline script.
  // Restore the saved preference before paint on each language change.
  useLayoutEffect(() => {
    let restored: Theme =
      document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') restored = stored;
    } catch {
      // Keep the current document preference when storage is unavailable.
    }
    document.documentElement.dataset.theme = restored;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync persisted preference before paint
    setTheme(restored);
  }, [locale]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Private mode: the theme still changes for this visit
      }
      return next;
    });
  }, []);

  // Cmd+K (Mac) or Ctrl+K (Windows/Linux) opens the command palette from anywhere
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOverlay((current) => (current === 'palette' ? null : 'palette'));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      theme,
      toggleTheme,
      overlay,
      open: (next) => setOverlay(next),
      close: () => setOverlay(null),
    }),
    [theme, toggleTheme, overlay],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value)
    throw new Error('useAppState must be used inside <AppStateProvider>');
  return value;
}
