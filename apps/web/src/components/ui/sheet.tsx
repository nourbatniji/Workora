'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import IconButton from './icon-button';

/** A side panel on the end side (right in English, left in Arabic), built on <dialog> like Modal */
export default function Sheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
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
      onClose={() => openRef.current && onClose()}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="ms-auto me-0 my-0 h-dvh max-h-dvh w-full max-w-md border-s border-line bg-surface p-0 text-text"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-5">
            <h2 className="truncate text-base font-medium">{title}</h2>
            <IconButton
              icon={X}
              label={closeLabel}
              onClick={onClose}
              bordered={false}
            />
          </div>
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-5">
            {children}
          </div>
        </div>
      )}
    </dialog>
  );
}
