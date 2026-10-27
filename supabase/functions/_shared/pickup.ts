// supabase/functions/_shared/pickup.ts
// Pure rules for recording a pickup (the start of a rental). No database, no model.
import { z } from 'zod';

/** Registration numbers are stored without spaces, upper case: "ga 07 m 2214" → "GA07M2214". */
export function normalizeRegNo(regNo: string): string {
  return regNo.replace(/\s+/g, '').toUpperCase();
}

/** The Bangalore branches a scooter can be picked up from (same list as the rentals.branch check). */
export const BRANCHES = ['Malleshwaram', 'Indiranagar', 'Bellandur', 'Koramangala', 'HSR Layout', 'Whitefield'] as const;
export type Branch = (typeof BRANCHES)[number];

export const StartRentalSchema = z.object({
  /** Chosen by the app before uploading, so the photos can go straight to {rental_id}/pickup/. */
  rental_id: z.string().uuid(),
  reg_no: z
    .string()
    .transform(normalizeRegNo)
    .pipe(z.string().regex(/^[A-Z0-9]{4,12}$/, 'Registration number: 4 to 12 letters and digits')),
  model: z.string().trim().min(1).max(60),
  colour: z.string().trim().max(40).optional(),
  rider_id: z.string().uuid(),
  branch: z.enum(BRANCHES),
});
export type StartRentalRequest = z.infer<typeof StartRentalSchema>;

/** Colour is optional on the form but required in the database. */
export function colourOrDefault(colour: string | undefined): string {
  return colour && colour.length > 0 ? colour : 'Not recorded';
}

/** A vehicle can start a new rental only when it has no rental still open (out, or back but not settled). */
export function openRentalBlocker(regNo: string, openStatuses: readonly string[]): string | null {
  return openStatuses.some((status) => status === 'active' || status === 'returned')
    ? `${regNo} is already out on a rental. Finish its return first.`
    : null;
}
