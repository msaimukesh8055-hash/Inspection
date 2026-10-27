// components/SendBackDialog.tsx
// Modal for the inspector to send a return back for reassessment: a reason from a fixed list and a note
// ("Other" needs one). Modelled on ReasonDialog.
import { CircleNotch } from '@phosphor-icons/react';
import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { SEND_BACK_REASONS } from '@/lib/inspection';
import type { SendBackReason } from '@/lib/inspection';

const REASON_KEYS = Object.keys(SEND_BACK_REASONS) as SendBackReason[];

type SendBackDialogProps = {
  vehicle: string;
  onConfirm: (reason: SendBackReason, note: string) => Promise<void>;
  onCancel: () => void;
};

export function SendBackDialog({ vehicle, onConfirm, onCancel }: SendBackDialogProps) {
  const [reason, setReason] = useState<SendBackReason | ''>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = reason !== '' && (reason !== 'other' || note.trim().length >= 3);

  function handleReason(event: ChangeEvent<HTMLSelectElement>) {
    setReason(REASON_KEYS.find((key) => key === event.target.value) ?? '');
  }

  function handleNote(event: ChangeEvent<HTMLTextAreaElement>) {
    setNote(event.target.value);
  }

  async function submit(chosen: SendBackReason) {
    setSaving(true);
    setError(null);
    try {
      await onConfirm(chosen, note.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid && !saving) void submit(reason);
  }

  function handleConfirmClick() {
    if (valid && !saving) void submit(reason);
  }

  return (
    <div
      className="fixed inset-0 z-20 grid place-items-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Send back for reassessment"
    >
      <form onSubmit={handleSubmit} className="w-[520px] space-y-6 rounded-3xl border border-line-strong bg-surface p-8">
        <div className="space-y-2">
          <h2 className="text-[24px] font-semibold tracking-tight">Send back for reassessment</h2>
          <p className="text-[15px] text-muted">
            {vehicle} goes back to the counter. They can retake any photo and run the AI again. This order closes.
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-[14px] font-medium">Reason</span>
          <select
            id="send-back-reason"
            autoFocus
            value={reason}
            onChange={handleReason}
            className="h-12 w-full rounded-xl border border-line-strong bg-black px-4 text-[15px] text-ink outline-none focus:border-ink"
          >
            <option value="">Choose a reason…</option>
            {REASON_KEYS.map(function renderReason(key) {
              return (
                <option key={key} value={key}>
                  {SEND_BACK_REASONS[key]}
                </option>
              );
            })}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-[14px] font-medium">
            Note {reason === 'other' ? <span className="font-normal text-subtle">(required)</span> : <span className="font-normal text-subtle">(optional)</span>}
          </span>
          <textarea
            id="send-back-note"
            value={note}
            onChange={handleNote}
            rows={3}
            maxLength={300}
            placeholder="What should the counter look at? e.g. Left mirror is cracked."
            className="w-full resize-none rounded-xl border border-line-strong bg-black px-4 py-3 text-[15px] text-ink outline-none placeholder:text-subtle focus:border-ink"
          />
        </label>
        {error && <p className="text-[14px] text-danger">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirmClick} disabled={!valid || saving} icon={saving ? <CircleNotch size={18} className="animate-spin" /> : undefined}>
            {saving ? 'Sending…' : 'Send back'}
          </Button>
        </div>
      </form>
    </div>
  );
}
