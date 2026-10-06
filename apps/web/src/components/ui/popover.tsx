'use client';

import { useEffect, useRef, useState } from 'react';

type PopoverProps = {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  label: string;
  width?: string;
  /** Pass open + onOpenChange to control it from outside (e.g. the rail bell opens the top-bar panel) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * A small dropdown panel under a trigger. Closes on outside click and on Esc.
 * The panel's end edge lines up with the trigger, so it grows towards the start side
 * (left in English, right in Arabic) and stays on screen.
 */
export default function Popover({
  trigger,
  children,
  label,
  width = 'w-80',
  open: openProp,
  onOpenChange,
}: PopoverProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (value: boolean) =>
    onOpenChange ? onOpenChange(value) : setOpenState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    function close() {
      if (onOpenChange) onOpenChange(false);
      else setOpenState(false);
    }
    // Wait one tick so the click that opened it doesn't close it again
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointer);
      document.addEventListener('keydown', onKey);
    });
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute end-0 top-full z-40 mt-2 ${width} max-w-[calc(100vw-2rem)] rounded-[14px] border border-line bg-surface p-2 text-text`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
