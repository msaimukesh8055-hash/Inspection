// supabase/functions/_shared/openrouter.ts
// The only place that calls a model. Every completed call is logged to agent_runs.
// Models are settings: swap them with Supabase secrets, no code change needed.
// Two providers, both OpenAI-style: a "gemini/<id>" model goes to Google's Gemini API (free tier,
// GEMINI_API_KEY); anything else goes to OpenRouter (OPENROUTER_API_KEY).
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types.ts';

type Provider = { name: 'openrouter' | 'gemini'; url: string; keyEnv: string; model: string };

const GEMINI_PREFIX = 'gemini/';

/** Where a model id is sent, and the id that provider expects. */
export function providerFor(model: string): Provider {
  if (model.startsWith(GEMINI_PREFIX)) {
    return {
      name: 'gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      keyEnv: 'GEMINI_API_KEY',
      model: model.slice(GEMINI_PREFIX.length),
    };
  }
  return { name: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions', keyEnv: 'OPENROUTER_API_KEY', model };
}

export type AgentName = 'damage' | 'estimate' | 'order';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
};

/** Model order per agent: the first that answers wins; the rest are fallbacks for rate limits or outages. */
export function modelsFor(agent: AgentName): string[] {
  // Gemini's free tier first. Its daily limit is per model and small (gemini-2.5-flash: 20 a day), so
  // the photo step gets the strongest Flash model to itself and the text steps use the Lite models and
  // Gemma, each on its own allowance. 3.8 Flash is left out: it hung past the 60 s timeout, which pushed
  // a whole assessment over Supabase's 150 s request limit. Nemotron (OpenRouter) is the last fallback.
  const text = ['gemini/gemini-3.1-flash-lite', 'gemini/gemini-flash-lite-latest', 'gemini/gemma-4-26b-a4b-it'];
  const defaults: Record<AgentName, string[]> = {
    damage: ['gemini/gemini-3.5-flash', 'gemini/gemini-2.5-flash', 'nvidia/nemotron-3.5-super-vl:free'],
    estimate: [...text, 'nvidia/nemotron-3.5-super-vl:free'],
    order: [...text, 'nvidia/nemotron-3.5-super-vl:free'],
  };
  const configured = Deno.env.get(`${agent.toUpperCase()}_MODELS`);
  return configured ? configured.split(',').map((m) => m.trim()).filter(Boolean) : defaults[agent];
}

type OpenRouterResponse = {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number; metadata?: { raw?: string; provider_name?: string } };
};

/** Free endpoints fail often: busy (429), down (5xx), or not offered to this account (404). */
const RETRYABLE_STATUS = new Set([404, 408, 429, 500, 502, 503, 504]);
const RETRY_PAUSE_MS = 2500;

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
  const provider = providerFor(model);
  const apiKey = Deno.env.get(provider.keyEnv);
  if (!apiKey) throw new Error(`${provider.keyEnv} is not set`);

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(provider.url, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(provider.name === 'openrouter' ? { 'X-Title': 'iInspect' } : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
        // OpenRouter-only: report the cost. Gemini's free tier has none.
        ...(provider.name === 'openrouter' ? { usage: { include: true } } : {}),
      }),
    });
  } catch (e) {
    throw new RetryableModelError(`${model}: ${e instanceof Error ? e.message : String(e)}`);
  }

  const raw: unknown = await response.json().catch(() => ({}));
  // Gemini wraps errors in a one-element array.
  const body = (Array.isArray(raw) ? (raw[0] ?? {}) : raw) as OpenRouterResponse;
  if (!response.ok || body.error) {
    const detail = body.error?.metadata?.raw ? ` (${body.error.metadata.raw.slice(0, 160)})` : '';
    const message = `${model}: HTTP ${response.status} ${body.error?.message ?? ''}${detail}`.trim();
    if (RETRYABLE_STATUS.has(response.status)) throw new RetryableModelError(message);
    throw new Error(message);
  }
  return { body, latencyMs: Date.now() - started };
}

/**
 * Sends one request, trying each model in order until one answers, and logs the call to agent_runs.
 * If every model fails with a retryable error, waits briefly and goes round once more.
 * Returns the raw text; callers validate it with Zod.
 */
export async function callModel({ db, agent, assessmentId, models, messages, timeoutMs = 60_000 }: CallOptions): Promise<ModelReply> {
  const failures: string[] = [];
  const attempts = [...models, ...models];
  for (const [i, model] of attempts.entries()) {
    if (i === models.length) await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
    try {
      const { body, latencyMs } = await callOnce(model, messages, timeoutMs);
      const text = body.choices?.[0]?.message?.content ?? '';
      const usedModel = providerFor(model).name === 'gemini' ? model : (body.model ?? model);

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
