import ExceptionsInbox from '@/components/exceptions/inbox';
import PrototypeBadge from '@/components/ui/prototype-badge';

/** Attendance exceptions inbox (SRS 3.8). UI prototype: client-side decisions on mock data (SCRUM-148). */
export default function ExceptionsPage() {
  return (
    <>
      <PrototypeBadge />
      <ExceptionsInbox />
    </>
  );
}
