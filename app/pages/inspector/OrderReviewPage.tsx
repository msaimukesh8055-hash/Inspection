// app/pages/inspector/OrderReviewPage.tsx
// Inspector: review one diagnostic order. Approve or adjust each AI line, add missed damage from the
// catalog, add notes, and confirm the final amount (which notifies the counter; it does not settle).
// Or send the return back to the counter for reassessment.
import { ArrowUUpLeft, CheckCircle, CircleNotch, ClipboardText, Plus, SealCheck, X } from '@phosphor-icons/react';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useAssessment } from '@/app/hooks/useAssessment';
import { useRentalData } from '@/app/hooks/useRentalData';
import { AnglePhotoCompare } from '@/components/AnglePhotoCompare';
import { Button, LinkButton } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { PageHeader } from '@/components/PageHeader';
import { SendBackDialog } from '@/components/SendBackDialog';
import type { LineItem } from '@/lib/assessments';
import { formatInr } from '@/lib/format';
import type { SendBackReason } from '@/lib/inspection';
import { confirmOrder, fetchCatalog, fetchOrderRental, sendBack } from '@/lib/orders';
import type { CatalogPart } from '@/lib/orders';
import { ANGLES, angleLabel } from '@/lib/photos';
import type { Angle } from '@/lib/photos';

type AddedPart = { partCode: string; description: string; finalInr: number; angle: Angle };

/** Whole rupees from a text box, or null if it is not a valid amount. */
function parseRupees(text: string): number | null {
  if (!/^\d{1,6}$/.test(text.trim())) return null;
  return Number(text.trim());
}

function LineRow({
  line,
  value,
  onChange,
}: {
  line: LineItem;
  value: string;
  onChange: (lineId: string, value: string) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(line.id, event.target.value);
  }
  const amount = parseRupees(value);
  const adjusted = amount !== null && amount !== line.totalInr;
  return (
    <div className="grid grid-cols-[1fr_112px_84px] items-center gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium">{line.description}</p>
        <p className="text-[13px] text-subtle">
          {line.partCode} · AI {formatInr(line.totalInr)}
        </p>
      </div>
      <label className="flex h-11 items-center gap-1 rounded-xl border border-line-strong bg-black px-3 focus-within:border-ink">
        <span className="text-muted">₹</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          aria-label={`Final amount for ${line.description}`}
          className="w-full bg-transparent text-[15px] outline-none"
        />
      </label>
      <span className={`text-right text-[13px] font-medium ${amount === null ? 'text-danger' : adjusted ? 'text-path-b' : 'text-path-a'}`}>
        {amount === null ? 'Invalid' : adjusted ? 'Adjusted' : 'Approved'}
      </span>
    </div>
  );
}

function AddedRow({ part, onRemove }: { part: AddedPart; onRemove: (partCode: string) => void }) {
  function handleRemove() {
    onRemove(part.partCode);
  }
  return (
    <div className="grid grid-cols-[1fr_112px_84px] items-center gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium">{part.description}</p>
        <p className="text-[13px] text-subtle">
          {angleLabel(part.angle)} · {part.partCode} · added by inspector
        </p>
      </div>
      <span className="px-3 text-[15px]">{formatInr(part.finalInr)}</span>
      <button
        type="button"
        onClick={handleRemove}
        aria-label={`Remove ${part.description}`}
        className="ml-auto grid size-9 place-items-center rounded-full text-muted hover:bg-hover hover:text-ink"
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  );
}

function OrderReview({ orderId, rentalId }: { orderId: string; rentalId: string }) {
  const navigate = useNavigate();
  const rentalData = useRentalData(rentalId, true);
  const { assessment, error, reload } = useAssessment(rentalId);
  const [catalog, setCatalog] = useState<CatalogPart[]>([]);
  const [finals, setFinals] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<AddedPart[]>([]);
  const [pick, setPick] = useState('');
  const [pickAngle, setPickAngle] = useState<Angle | ''>('');
  const [notes, setNotes] = useState('');
  const [chosenAngle, setChosenAngle] = useState<Angle | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sendingBack, setSendingBack] = useState(false);

  const model = rentalData.data?.rental.model;
  useEffect(
    function loadCatalog() {
      if (!model) return;
      fetchCatalog(model)
        .then(setCatalog)
        .catch(function handleError(e: unknown) {
          setSaveError(e instanceof Error ? e.message : String(e));
        });
    },
    [model],
  );

  function handleRetry() {
    rentalData.retry();
    reload();
  }

  const data = rentalData.data;
  if (!data || assessment === undefined) return <LoadState error={rentalData.error ?? error} onRetry={handleRetry} />;
  if (!assessment?.order || assessment.order.id !== orderId) {
    return <LoadState error="This order no longer exists (it may have been downgraded or re-assessed)." onRetry={handleRetry} />;
  }

  const order = assessment.order;
  const aiLines = assessment.lines.filter((l) => l.source === 'ai');
  const confirmed = order.status !== 'open';
  const valueFor = (line: LineItem) => finals[line.id] ?? String(line.finalInr ?? line.totalInr);
  const amounts = aiLines.map((line) => parseRupees(valueFor(line)));
  const allValid = amounts.every((a) => a !== null);
  const draftTotal = amounts.reduce<number>((sum, a) => sum + (a ?? 0), 0) + added.reduce((sum, a) => sum + a.finalInr, 0);
  const finalTotal = confirmed ? (order.finalTotalInr ?? 0) : draftTotal;
  const difference = finalTotal - order.provisionalTotalInr;
  const counts = Object.fromEntries(ANGLES.map((a) => [a, assessment.items.filter((i) => i.angle === a).length])) as Record<Angle, number>;
  const angle = chosenAngle ?? assessment.items[0]?.angle ?? 'front';
  const addable = catalog.filter((p) => !added.some((a) => a.partCode === p.partCode));

  function handleFinal(lineId: string, value: string) {
    setFinals(function update(prev) {
      return { ...prev, [lineId]: value };
    });
  }

  function handlePick(event: ChangeEvent<HTMLSelectElement>) {
    setPick(event.target.value);
  }

  function handlePickAngle(event: ChangeEvent<HTMLSelectElement>) {
    setPickAngle(ANGLES.find((a) => a === event.target.value) ?? '');
  }

  function handleAdd() {
    const part = catalog.find((p) => p.partCode === pick);
    if (!part || pickAngle === '') return;
    const side = pickAngle;
    setAdded(function addPart(prev) {
      return [...prev, { partCode: part.partCode, description: part.description, finalInr: part.totalInr, angle: side }];
    });
    setPick('');
    setPickAngle('');
  }

  function handleRemove(partCode: string) {
    setAdded(function removePart(prev) {
      return prev.filter((p) => p.partCode !== partCode);
    });
  }

  function handleNotes(event: ChangeEvent<HTMLTextAreaElement>) {
    setNotes(event.target.value);
  }

  async function confirm() {
    setSaving(true);
    setSaveError(null);
    try {
      await confirmOrder({
        orderId,
        lines: aiLines.map((line) => ({ lineId: line.id, finalInr: parseRupees(valueFor(line)) ?? line.totalInr })),
        added: added.map((a) => ({ partCode: a.partCode, finalInr: a.finalInr, angle: a.angle })),
        notes,
      });
      reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleConfirm() {
    void confirm();
  }

  function handleBack() {
    navigate('/inspector');
  }

  function openSendBack() {
    setSendingBack(true);
  }

  function closeSendBack() {
    setSendingBack(false);
  }

  async function confirmSendBack(reason: SendBackReason, note: string) {
    await sendBack(orderId, reason, note);
    navigate('/inspector');
  }

  const differenceText = difference === 0 ? 'No change' : `${difference > 0 ? '+' : '−'}${formatInr(Math.abs(difference))}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Inspector · ${order.priority} priority`}
        title={`${data.rental.model} · ${data.rental.regNo}`}
        subtitle={confirmed ? 'Final amount confirmed. The counter has been notified.' : 'Approve or adjust each line, add anything the AI missed, then confirm.'}
      />

      <div className="grid grid-cols-[1fr_470px] gap-8">
        <div className="space-y-5">
          <div className="flex gap-4 rounded-2xl border border-path-b/40 bg-path-b/5 p-5">
            <ClipboardText size={24} weight="duotone" className="shrink-0 text-path-b" />
            <p className="text-[15px] leading-relaxed">{order.summary}</p>
          </div>
          <AnglePhotoCompare angle={angle} onSelect={setChosenAngle} pickup={data.photos.pickup} returned={data.photos.return} counts={counts} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface">
            {confirmed
              ? assessment.lines.map(function renderConfirmed(line) {
                  return (
                    <div key={line.id} className="flex items-center justify-between border-b border-line px-5 py-4">
                      <div>
                        <p className="text-[15px] font-medium">{line.description}</p>
                        <p className="text-[13px] text-subtle">
                          {line.source === 'ai' ? `AI ${formatInr(line.totalInr)}` : 'Added by inspector'}
                        </p>
                      </div>
                      <span className="text-[15px] font-medium">{formatInr(line.finalInr ?? line.totalInr)}</span>
                    </div>
                  );
                })
              : aiLines.map(function renderLine(line) {
                  return <LineRow key={line.id} line={line} value={valueFor(line)} onChange={handleFinal} />;
                })}
            {!confirmed &&
              added.map(function renderAdded(part) {
                return <AddedRow key={part.partCode} part={part} onRemove={handleRemove} />;
              })}
            {!confirmed && (
              <div className="flex gap-2 border-b border-line px-5 py-4">
                <select
                  value={pick}
                  onChange={handlePick}
                  aria-label="Part for missed damage"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-line-strong bg-black px-3 text-[14px] text-ink outline-none focus:border-ink"
                >
                  <option value="">Add missing damage: choose a part…</option>
                  {addable.map(function renderOption(part) {
                    return (
                      <option key={part.partCode} value={part.partCode}>
                        {part.description} · {formatInr(part.totalInr)}
                      </option>
                    );
                  })}
                </select>
                <select
                  value={pickAngle}
                  onChange={handlePickAngle}
                  aria-label="Side of the missed damage"
                  className="h-11 w-[104px] shrink-0 rounded-xl border border-line-strong bg-black px-3 text-[14px] text-ink outline-none focus:border-ink"
                >
                  <option value="">Side…</option>
                  {ANGLES.map(function renderSide(side) {
                    return (
                      <option key={side} value={side}>
                        {angleLabel(side)}
                      </option>
                    );
                  })}
                </select>
                <Button variant="secondary" onClick={handleAdd} disabled={!pick || pickAngle === ''} icon={<Plus size={16} weight="bold" />}>
                  Add
                </Button>
              </div>
            )}
            <div className="space-y-1 px-5 py-4 text-[14px]">
              <div className="flex justify-between text-muted">
                <span>AI estimate</span>
                <span>{formatInr(order.provisionalTotalInr)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Difference</span>
                <span className={difference === 0 ? '' : 'text-path-b'}>{differenceText}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[15px]">Final amount</span>
                <span className="text-[24px] font-semibold">{formatInr(finalTotal)}</span>
              </div>
            </div>
          </div>

          {confirmed ? (
            <div className="flex items-center gap-3 rounded-2xl border border-path-a/40 bg-path-a/5 p-5">
              <SealCheck size={26} weight="duotone" className="text-path-a" />
              <p className="text-[15px]">{order.inspectorNotes ? `Notes: ${order.inspectorNotes}` : 'Confirmed without notes.'}</p>
            </div>
          ) : (
            <textarea
              value={notes}
              onChange={handleNotes}
              rows={2}
              maxLength={500}
              placeholder="Notes for the counter (optional)"
              className="w-full resize-none rounded-2xl border border-line bg-surface px-5 py-4 text-[15px] text-ink outline-none placeholder:text-subtle focus:border-line-strong"
            />
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line pt-6">
        <Button variant="secondary" onClick={handleBack}>
          Back to orders
        </Button>
        <div className="flex items-center gap-4">
          {saveError && <p className="max-w-md text-[14px] text-danger">{saveError}</p>}
          {confirmed ? (
            <LinkButton to="/inspector">Next order</LinkButton>
          ) : (
            <>
              <Button variant="secondary" onClick={openSendBack} disabled={saving} icon={<ArrowUUpLeft size={18} weight="bold" />}>
                Send back for reassessment
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={saving || !allValid}
                icon={saving ? <CircleNotch size={18} className="animate-spin" /> : <CheckCircle size={18} weight="bold" />}
              >
                Confirm final amount
              </Button>
            </>
          )}
        </div>
      </div>
      {sendingBack && <SendBackDialog vehicle={`${data.rental.model} ${data.rental.regNo}`} onConfirm={confirmSendBack} onCancel={closeSendBack} />}
    </div>
  );
}

export function OrderReviewPage() {
  const { orderId = '' } = useParams();
  const [rentalId, setRentalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(
    function findRental() {
      fetchOrderRental(orderId)
        .then(setRentalId)
        .catch(function handleError(e: unknown) {
          setError(e instanceof Error ? e.message : String(e));
        });
    },
    [orderId, attempt],
  );

  function handleRetry() {
    setError(null);
    setAttempt(function next(n) {
      return n + 1;
    });
  }

  if (!rentalId) return <LoadState error={error} onRetry={handleRetry} />;
  return <OrderReview orderId={orderId} rentalId={rentalId} />;
}
