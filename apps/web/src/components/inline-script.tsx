'use client';

// A client component, so the type check below sees `window` in the browser and renders text/plain
// there (React warns when it renders a real <script> on the client). On the server it renders
// text/javascript, which the browser runs before the first paint.
/**
 * Inline script that runs before the first paint (Next.js guide: "Preventing flash before hydration").
 * On the client it becomes text/plain, so React doesn't warn about rendering a <script>.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
