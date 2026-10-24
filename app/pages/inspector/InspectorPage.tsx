// app/pages/inspector/InspectorPage.tsx
// Inspector: order queue. Built in Milestone 6; this page holds its place.
import { ClipboardText } from '@phosphor-icons/react';

import { IconTile } from '@/components/IconTile';
import { PageHeader } from '@/components/PageHeader';

export function InspectorPage() {
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Inspector" title="Diagnostic orders" subtitle="Orders raised by the Detector appear here." />
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-line px-10 py-24 text-center">
        <IconTile size="lg">
          <ClipboardText size={32} weight="duotone" />
        </IconTile>
        <div className="space-y-2">
          <p className="text-[20px] font-semibold">No orders yet</p>
          <p className="text-muted">The order queue and review screen arrive in Milestone 6.</p>
        </div>
      </div>
    </div>
  );
}
