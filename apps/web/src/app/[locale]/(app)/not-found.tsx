import NotFoundCard from '@/components/not-found-card';

/** Inside the app: the 404 card sits in the shell, so the menu is still there to move on */
export default function AppNotFound() {
  return (
    <div className="mt-6">
      <NotFoundCard />
    </div>
  );
}
