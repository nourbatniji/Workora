'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import IconButton from './icon-button';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  closeLabel: string;
  children: React.ReactNode;
  /** Extra classes for the panel, e.g. a wider max width */
  className?: string;
  /** Hide the title row (the command palette draws its own) */
  bare?: boolean;
  /** Where the panel sits: centred, or near the top like a command palette */
  position?: 'center' | 'top';
};

/**
 * Built on the native <dialog> element: it traps focus, closes on Esc,
 * and puts the rest of the page behind a backdrop without extra libraries.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
  className = '',
  bare = false,
  position = 'center',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      // The browser fires "close" both for Esc and when we close it ourselves;
      // only Esc (while we still think it's open) should report back
      onClose={() => openRef.current && onClose()}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself
        if (event.target === ref.current) onClose();
      }}
      className={`w-[calc(100%-2rem)] max-w-lg overflow-visible rounded-[14px] border border-line bg-surface p-0 text-text ${
        position === 'top' ? 'mx-auto mt-[12vh] mb-auto' : 'm-auto'
      } ${className}`}
    >
      {open && (
        <div className={bare ? '' : 'p-5 md:p-6'}>
          {!bare && (
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">{title}</h2>
                {description && (
                  <p className="mt-1 text-[13px] text-muted">{description}</p>
                )}
              </div>
              <IconButton
                icon={X}
                label={closeLabel}
                onClick={onClose}
                bordered={false}
              />
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
