// components/Button.tsx
// White primary, outlined secondary, quiet ghost. Works as a button or a router link.
import type { ReactNode } from 'react';
import { Link } from 'react-router';

type Variant = 'primary' | 'secondary' | 'ghost';

const BASE =
  'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-35';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-black hover:bg-neutral-200',
  secondary: 'border border-line-strong bg-transparent text-ink hover:bg-hover',
  ghost: 'bg-transparent text-muted hover:bg-hover hover:text-ink',
};

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  icon?: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps & {
  onClick: () => void;
  disabled?: boolean;
};

export function Button({ children, variant = 'primary', icon, className = '', onClick, disabled = false }: ButtonProps) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {icon}
      {children}
    </button>
  );
}

type LinkButtonProps = CommonProps & { to: string };

export function LinkButton({ children, variant = 'primary', icon, className = '', to }: LinkButtonProps) {
  return (
    <Link to={to} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {icon}
      {children}
    </Link>
  );
}
