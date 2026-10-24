// components/ReasonDialog.tsx
// Modal that asks for a one-line reason before an override (escalate or downgrade).
import { CircleNotch } from '@phosphor-icons/react';
import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/Button';

type ReasonDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
};

export function ReasonDialog({ title, description, confirmLabel, onConfirm, onCancel }: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = reason.trim().length >= 3;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setReason(event.target.value);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid && !saving) void submit();
  }

  function handleConfirmClick() {
    if (valid && !saving) void submit();
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <form onSubmit={handleSubmit} className="w-[520px] space-y-6 rounded-3xl border border-line-strong bg-surface p-8">
        <div className="space-y-2">
          <h2 className="text-[24px] font-semibold tracking-tight">{title}</h2>
          <p className="text-[15px] text-muted">{description}</p>
        </div>
        <input
          autoFocus
          value={reason}
          onChange={handleChange}
          maxLength={200}
          placeholder="One-line reason (saved with the override)"
          className="h-12 w-full rounded-xl border border-line-strong bg-black px-4 text-[15px] text-ink outline-none placeholder:text-subtle focus:border-ink"
        />
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirmClick} disabled={!valid || saving} icon={saving ? <CircleNotch size={18} className="animate-spin" /> : undefined}>
            {saving ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
