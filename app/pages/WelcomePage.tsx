// app/pages/WelcomePage.tsx
// Role picker. No login in the demo: pick Detector or Inspector.
import { ArrowRight, MagnifyingGlass, Wrench } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { IconTile } from '@/components/IconTile';

type RoleCardProps = {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
};

function RoleCard({ to, icon, title, description }: RoleCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between gap-16 rounded-3xl border border-line bg-surface p-10 transition-colors hover:border-line-strong hover:bg-raised"
    >
      <IconTile size="lg">{icon}</IconTile>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[28px] font-semibold tracking-tight">{title}</h2>
          <ArrowRight size={24} className="text-subtle transition-transform group-hover:translate-x-1 group-hover:text-ink" />
        </div>
        <p className="max-w-sm text-[16px] leading-relaxed text-muted">{description}</p>
      </div>
    </Link>
  );
}

export function WelcomePage() {
  return (
    <div className="space-y-14 pt-6">
      <div className="max-w-2xl space-y-4">
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-subtle">Scooter return inspection</p>
        <h1 className="text-[56px] font-semibold leading-[1.05] tracking-tight">Inspect a return in two minutes.</h1>
        <p className="text-[18px] text-muted">Choose how you are working today.</p>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <RoleCard
          to="/detector"
          icon={<MagnifyingGlass size={32} weight="duotone" />}
          title="Detector"
          description="Check returned scooters from photos, bill minor damage, and raise orders for the rest."
        />
        <RoleCard
          to="/inspector"
          icon={<Wrench size={32} weight="duotone" />}
          title="Inspector"
          description="Review diagnostic orders, adjust each line and confirm the final amount."
        />
      </div>
    </div>
  );
}
