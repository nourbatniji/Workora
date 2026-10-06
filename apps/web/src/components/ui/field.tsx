// Form field parts shared by every form: the invite dialog, the exceptions panel and the auth pages

export function inputClass(invalid: boolean) {
  return `h-10 w-full rounded-[10px] border bg-surface px-3 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent ${
    invalid ? 'border-danger' : 'border-line'
  }`;
}

/** Label + input + error. The error sits outside the <label> so it isn't read as part of the field's name. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium">
          {label}
          {hint && (
            <span className="text-xs font-normal text-muted">({hint})</span>
          )}
        </span>
        {children}
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
