// supabase/functions/_shared/openrouter.ts
// The only place that calls a model. Every completed call is logged to agent_runs.
// Models are settings: swap them with Supabase secrets, no code change needed.
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types.ts';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type AgentName = 'damage' | 'estimate' | 'order';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

/** Model order per agent: the first that answers wins; the rest are fallbacks for rate limits or outages. */
export function modelsFor(agent: AgentName): string[] {
  const defaults: Record<AgentName, string[]> = {
    // Nemotron first: Gemma's free endpoint was rate-limited (429) on every test call.
    damage: ['nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-31b-it:free'],
    estimate: ['google/gemma-4-31b-it:free'],
    order: ['google/gemma-4-31b-it:free'],
  };
  const configured = Deno.env.get(`${agent.toUpperCase()}_MODELS`);
  return configured ? configured.split(',').map((m) => m.trim()).filter(Boolean) : defaults[agent];
}

type OpenRouterResponse = {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number };
};

/** skipped: models tried first that failed (rate limit, outage, empty reply), with the reason. */
export type ModelReply = { text: string; model: string; skipped: string[] };

type CallOptions = {
  db: SupabaseClient<Database>;
  agent: AgentName;
  assessmentId: string;
  models: string[];
  messages: ChatMessage[];
  timeoutMs?: number;
};

/** Errors worth trying the next model for: rate limits, provider outages, timeouts. */
class RetryableModelError extends Error {}

async function callOnce(model: string, messages: ChatMessage[], timeoutMs: number): Promise<{ body: OpenRouterResponse; latencyMs: number }> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'I Inspect',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
        usage: { include: true },
      }),
    });
  } catch (e) {
    throw new RetryableModelError(`${model}: ${e instanceof Error ? e.message : String(e)}`);
  }

  const body = (await response.json().catch(() => ({}))) as OpenRouterResponse;
  if (!response.ok || body.error) {
    const message = `${model}: HTTP ${response.status} ${body.error?.message ?? ''}`.trim();
    if (response.status === 429 || response.status >= 500 || response.status === 408) throw new RetryableModelError(message);
    throw new Error(message);
  }
  return { body, latencyMs: Date.now() - started };
}

/**
 * Sends one request, trying each model in order until one answers, and logs the call to agent_runs.
 * Returns the raw text; callers validate it with Zod.
 */
export async function callModel({ db, agent, assessmentId, models, messages, timeoutMs = 60_000 }: CallOptions): Promise<ModelReply> {
  const failures: string[] = [];
  for (const model of models) {
    try {
      const { body, latencyMs } = await callOnce(model, messages, timeoutMs);
      const text = body.choices?.[0]?.message?.content ?? '';
      const usedModel = body.model ?? model;

      const log = await db.from('agent_runs').insert({
        assessment_id: assessmentId,
        agent,
        model: usedModel,
        tokens_in: body.usage?.prompt_tokens ?? 0,
        tokens_out: body.usage?.completion_tokens ?? 0,
        latency_ms: latencyMs,
        cost_usd: body.usage?.cost ?? 0,
      });
      if (log.error) console.error(`agent_runs insert failed: ${log.error.message}`);

      if (!text.trim()) throw new RetryableModelError(`${model}: empty reply`);
      return { text, model: usedModel, skipped: failures };
    } catch (e) {
      if (!(e instanceof RetryableModelError)) throw e;
      console.warn(`model skipped: ${e.message}`);
      failures.push(e.message);
    }
  }
  throw new Error(`All models failed: ${failures.join(' | ')}`);
}
