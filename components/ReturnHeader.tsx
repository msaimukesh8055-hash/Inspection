// components/ReturnHeader.tsx
// Header for the return steps: back link, the scooter being returned, and the three-step progress.
import { ArrowLeft, Check } from '@phosphor-icons/react';
import { Link } from 'react-router';

import type { RentalSummary } from '@/lib/rentals';

const STEPS = ['Choose photos', 'Review & upload', 'Uploaded'] as const;

type ReturnHeaderProps = {
  rental: RentalSummary;
  step: 1 | 2 | 3;
  title: string;
  subtitle: string;
};

function StepDot({ index, step }: { index: number; step: number }) {
  const done = index < step;
  const current = index === step;
  return (
    <span
      className={`grid size-7 place-items-center rounded-full text-[13px] font-semibold ${
        done || current ? 'bg-ink text-black' : 'border border-line-strong text-subtle'
      }`}
    >
      {done ? <Check size={14} weight="bold" /> : index}
    </span>
  );
}

export function ReturnHeader({ rental, step, title, subtitle }: ReturnHeaderProps) {
  return (
    <header className="space-y-8">
      <div className="flex items-center justify-between">
        <Link to="/detector" className="flex items-center gap-2 text-[14px] text-muted transition-colors hover:text-ink">
          <ArrowLeft size={18} />
          All rentals
        </Link>
        <ol className="flex items-center gap-3">
          {STEPS.map(function renderStep(label, i) {
            const index = i + 1;
            return (
              <li key={label} className="flex items-center gap-3">
                <StepDot index={index} step={step} />
                <span className={`text-[14px] ${index === step ? 'font-medium text-ink' : 'text-subtle'}`}>{label}</span>
                {index < STEPS.length && <span className="h-px w-10 bg-line-strong" />}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="space-y-2">
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">
          {rental.model} · {rental.regNo} · {rental.riderName}
        </p>
        <h1 className="text-[40px] font-semibold leading-tight tracking-tight">{title}</h1>
        <p className="text-[17px] text-muted">{subtitle}</p>
      </div>
    </header>
  );
}
