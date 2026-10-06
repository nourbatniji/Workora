/** White card: 14px radius, 1px border, 20–24px padding, no shadow */
export function Card({
  children,
  className = '',
  as: Tag = 'section',
  flush = false,
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'div' | 'article';
  /** No inner padding (lists that run edge to edge) */ flush?: boolean;
}) {
  return (
    <Tag
      className={`h-full rounded-[14px] border border-line bg-surface ${flush ? '' : 'p-5 md:p-6'} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Card title row: 16px medium title, optional 12–13px hint and an action on the end side */
export function CardHeader({
  title,
  hint,
  action,
  id,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-medium text-text">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
