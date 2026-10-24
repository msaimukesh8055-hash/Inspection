// supabase/functions/_shared/agent.ts
// One agent turn: call the model, validate, retry once with the error fed back, then give up.
// Giving up means the caller marks the return needs_human (Path B), per the spec.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types.ts';
import { callModel, modelsFor } from './openrouter.ts';
import type { AgentName, ChatMessage } from './openrouter.ts';
import { retryPrompt } from './prompts.ts';
import type { ParseResult } from './schemas.ts';

export type AgentResult<T> =
  | { ok: true; data: T; model: string; skipped: string[] }
  | { ok: false; error: string; skipped: string[] };

type RunAgentOptions<T> = {
  db: SupabaseClient<Database>;
  agent: AgentName;
  assessmentId: string;
  messages: ChatMessage[];
  parse: (text: string) => ParseResult<T>;
  /** true: if every model is down, report a failed result (the caller routes to a human) instead of throwing. */
  outageIsFailure?: boolean;
};

export async function runAgent<T>({ db, agent, assessmentId, messages, parse, outageIsFailure = false }: RunAgentOptions<T>): Promise<AgentResult<T>> {
  const conversation = [...messages];
  const skipped: string[] = [];
  let lastError = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let reply;
    try {
      reply = await callModel({ db, agent, assessmentId, models: modelsFor(agent), messages: conversation });
    } catch (e) {
      if (!outageIsFailure) throw e;
      return { ok: false, error: e instanceof Error ? e.message : String(e), skipped };
    }
    skipped.push(...reply.skipped);
    const parsed = parse(reply.text);
    if (parsed.ok) return { ok: true, data: parsed.data, model: reply.model, skipped };
    lastError = parsed.error;
    conversation.push({ role: 'assistant', content: reply.text });
    conversation.push({ role: 'user', content: retryPrompt(parsed.error) });
  }
  return { ok: false, error: lastError, skipped };
}
