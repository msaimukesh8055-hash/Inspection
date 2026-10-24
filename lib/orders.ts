// lib/orders.ts
// Inspector side: the queue of open diagnostic orders, one order for review, and confirming the final amount.
import { invokeFunction } from './functions';
import { supabase } from './supabase';

export type QueuedOrder = {
  id: string;
  rentalId: string;
  createdAt: string;
  priority: 'low' | 'normal' | 'high';
  provisionalTotalInr: number;
  reasons: string[];
  model: string;
  regNo: string;
  riderName: string;
};

export type CatalogPart = { partCode: string; description: string; totalInr: number };

const PRIORITIES = ['low', 'normal', 'high'] as const;

/** Open diagnostic orders, newest first. */
export async function fetchOpenOrders(): Promise<QueuedOrder[]> {
  const { data, error } = await supabase
    .from('diagnostic_orders')
    .select('id, created_at, priority, provisional_total_inr, route_reasons, assessments(rental_id, rentals(vehicles(model, reg_no), riders(name)))')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  return data.map(function toQueued(row): QueuedOrder {
    const rental = row.assessments?.rentals;
    return {
      id: row.id,
      rentalId: row.assessments?.rental_id ?? '',
      createdAt: row.created_at,
      priority: PRIORITIES.find((p) => p === row.priority) ?? 'normal',
      provisionalTotalInr: row.provisional_total_inr,
      reasons: row.route_reasons,
      model: rental?.vehicles?.model ?? 'Unknown',
      regNo: rental?.vehicles?.reg_no ?? '',
      riderName: rental?.riders?.name ?? '',
    };
  });
}

/** The rental an order belongs to, so the review page can load its photos and assessment. */
export async function fetchOrderRental(orderId: string): Promise<string> {
  const { data, error } = await supabase.from('diagnostic_orders').select('assessments(rental_id)').eq('id', orderId).single();
  if (error) throw new Error(error.message);
  const rentalId = data.assessments?.rental_id;
  if (!rentalId) throw new Error('Order has no rental');
  return rentalId;
}

/** Parts the inspector may add for missed damage: this vehicle's catalog only. */
export async function fetchCatalog(model: string): Promise<CatalogPart[]> {
  const { data, error } = await supabase
    .from('parts_catalog')
    .select('part_code, description, parts_inr, labour_inr')
    .eq('vehicle_model', model)
    .order('part_code');
  if (error) throw new Error(error.message);
  return data.map((p) => ({ partCode: p.part_code, description: p.description, totalInr: p.parts_inr + p.labour_inr }));
}

export type ConfirmOrderInput = {
  orderId: string;
  lines: { lineId: string; finalInr: number }[];
  added: { partCode: string; finalInr: number }[];
  notes: string;
};

/** Saves the inspector's final amounts and notifies the counter. Does not settle the deposit. */
export function confirmOrder(input: ConfirmOrderInput): Promise<void> {
  return invokeFunction('confirm-order', {
    order_id: input.orderId,
    lines: input.lines.map((l) => ({ line_id: l.lineId, final_inr: l.finalInr })),
    added: input.added.map((a) => ({ part_code: a.partCode, final_inr: a.finalInr })),
    notes: input.notes,
  });
}
