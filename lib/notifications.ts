// lib/notifications.ts
// In-app notifications per demo role, kept live with Supabase Realtime.
import { supabase } from './supabase';

export type Role = 'counter' | 'inspector';

export type AppNotification = {
  id: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  rentalId: string | null;
  /** The return's status now; 'sent_back' means the inspector wants it assessed again. */
  assessmentStatus: string | null;
};

export async function fetchNotifications(role: Role): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, message, created_at, read_at, assessments(rental_id, status)')
    .eq('recipient_role', role)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data.map((n) => ({
    id: n.id,
    message: n.message,
    createdAt: n.created_at,
    readAt: n.read_at,
    rentalId: n.assessments?.rental_id ?? null,
    assessmentStatus: n.assessments?.status ?? null,
  }));
}

/** The app may only set read_at (column grant); everything else is written by Edge Functions. */
export async function markRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Calls onChange whenever a notification for this role is added or updated. Returns an unsubscribe function. */
export function subscribeToNotifications(role: Role, onChange: () => void): () => void {
  const channel = supabase
    .channel(`notifications-${role}-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_role=eq.${role}` }, onChange)
    .subscribe();
  return function unsubscribe() {
    void supabase.removeChannel(channel);
  };
}
