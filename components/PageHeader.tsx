// components/PageHeader.tsx
// Page title block: small eyebrow, large title, one line of context, optional actions on the right.
import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-8">
      <div className="space-y-2">
        {eyebrow && <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">{eyebrow}</p>}
        <h1 className="text-[40px] font-semibold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="text-[17px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </header>
  );
}
