import type { LucideIcon } from 'lucide-react';
import { forwardRef } from 'react';

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  /** Spoken by screen readers and shown as a tooltip */
  label: string;
  /** Small dot or number on the corner, e.g. unread notifications */
  badge?: number | 'dot';
  /** Flip the icon in right-to-left layouts (arrows, chevrons) */
  mirror?: boolean;
  bordered?: boolean;
};

/** 36px square, 10px radius, thin outline icon */
const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon: Icon,
      label,
      badge,
      mirror,
      bordered = true,
      className = '',
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-text transition-colors hover:bg-canvas ${
          bordered ? 'border border-line bg-surface' : ''
        } ${className}`}
        {...rest}
      >
        <Icon
          className={`size-[18px] ${mirror ? 'rtl:-scale-x-100' : ''}`}
          strokeWidth={1.5}
          aria-hidden
        />
        {badge === 'dot' && (
          <span className="absolute end-2 top-2 size-1.5 rounded-full bg-danger ring-2 ring-surface" />
        )}
        {typeof badge === 'number' && badge > 0 && (
          <span className="absolute -end-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-medium text-white tabular-nums">
            {badge}
          </span>
        )}
      </button>
    );
  },
);

export default IconButton;
