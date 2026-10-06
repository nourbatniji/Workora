/** MDARJ mark: three rising steps (مدارج means "steps") in a royal-blue tile */
export default function LogoMark({
  className = 'size-9',
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden>
      <rect width="36" height="36" rx="10" fill="var(--accent)" />
      <rect
        x="9"
        y="20"
        width="5"
        height="7"
        rx="1.5"
        fill="#fff"
        fillOpacity="0.55"
      />
      <rect
        x="15.5"
        y="15"
        width="5"
        height="12"
        rx="1.5"
        fill="#fff"
        fillOpacity="0.8"
      />
      <rect x="22" y="9" width="5" height="18" rx="1.5" fill="#fff" />
    </svg>
  );
}
