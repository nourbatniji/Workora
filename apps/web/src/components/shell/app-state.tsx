'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  notifications as initialNotifications,
  type MockNotification,
} from '@/mock/shell';

export type Theme = 'light' | 'dark';
export type Role = 'admin' | 'employee' | 'interviewer';
export type Overlay = 'palette' | 'invite' | 'lawRef' | 'help' | 'menu' | null;

type AppState = {
  theme: Theme;
  toggleTheme: () => void;
  /** Development only: preview another role's screens. null = show the real role */
  previewRole: Role | null;
  setPreviewRole: (role: Role | null) => void;
  overlay: Overlay;
  open: (overlay: Exclude<Overlay, null>) => void;
  close: () => void;
  notifications: MockNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
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
  const [previewRole, setPreviewRole] = useState<Role | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Pick up the theme the head script already applied
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the DOM
    setTheme(
      document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
    );
  }, []);

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
      previewRole,
      setPreviewRole,
      overlay,
      open: (next) => setOverlay(next),
      close: () => setOverlay(null),
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markRead: (id) =>
        setNotifications((list) =>
          list.map((n) => (n.id === id ? { ...n, read: true } : n)),
        ),
      markAllRead: () =>
        setNotifications((list) => list.map((n) => ({ ...n, read: true }))),
      notificationsOpen,
      setNotificationsOpen,
    }),
    [
      theme,
      toggleTheme,
      previewRole,
      overlay,
      notifications,
      notificationsOpen,
    ],
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
