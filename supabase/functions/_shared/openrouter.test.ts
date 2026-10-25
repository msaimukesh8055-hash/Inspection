// supabase/functions/_shared/openrouter.test.ts
import { describe, expect, it } from 'vitest';

import { providerFor } from './openrouter.ts';

describe('providerFor', () => {
  it('sends gemini/ models to the Gemini API without the prefix', () => {
    const provider = providerFor('gemini/gemini-3.8-flash');
    expect(provider.name).toBe('gemini');
    expect(provider.model).toBe('gemini-3.8-flash');
    expect(provider.keyEnv).toBe('GEMINI_API_KEY');
    expect(provider.url).toContain('generativelanguage.googleapis.com');
  });

  it('sends every other model to OpenRouter unchanged', () => {
    const provider = providerFor('nvidia/nemotron-3.5-super-vl:free');
    expect(provider.name).toBe('openrouter');
    expect(provider.model).toBe('nvidia/nemotron-3.5-super-vl:free');
    expect(provider.keyEnv).toBe('OPENROUTER_API_KEY');
  });

  it('treats a Gemma model on OpenRouter as OpenRouter', () => {
    expect(providerFor('google/gemma-4-31b-it:free').name).toBe('openrouter');
  });
});
