import AppShell from '@/components/shell/app-shell';
import { ExceptionsProvider } from '@/components/exceptions/exceptions-store';

/** Pages inside the app: the sidebar shell around them (route group, no effect on URLs) */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ExceptionsProvider>
      <AppShell>{children}</AppShell>
    </ExceptionsProvider>
  );
}
