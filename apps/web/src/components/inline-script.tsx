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
