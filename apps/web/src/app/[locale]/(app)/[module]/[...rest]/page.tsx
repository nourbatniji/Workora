import { notFound } from 'next/navigation';

/**
 * Deeper addresses nobody built yet, like /exceptions/abc or /users/x/y: show the 404 card
 * inside the shell instead of Next.js's plain default page.
 */
export default function UnknownPage() {
  notFound();
}
