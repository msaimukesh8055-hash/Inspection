// supabase/functions/_shared/format.ts
// Display formatting for rupees and times (India locale). Shared by the web app (lib/format.ts) and functions.

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
