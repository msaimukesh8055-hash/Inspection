// supabase/functions/deno-globals.d.ts
// The few Deno globals the Edge Functions use, so the project-wide `tsc` can check them too.
// Deno itself ignores this file and uses its own built-in types.

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
