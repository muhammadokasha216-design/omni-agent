import { createClient } from '@supabase/supabase-js';

// NOTE: In Vite, only VITE_-prefixed vars are exposed on import.meta.env.
// The Supabase integration may provision NEXT_PUBLIC_* / unprefixed names instead,
// so we fall back across the common variants to avoid a silent "undefined client".
const env = import.meta.env as Record<string, string | undefined>;
const url = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? '';
const key =
  env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY ?? '';

// [v0] Config diagnostics — confirm the client is wired to a real project.
console.log('[v0][supabase] config check', {
  hasUrl: Boolean(url),
  hasAnonKey: Boolean(key),
  // Log the project ref (the subdomain), never the full key.
  projectRef: url ? url.replace(/^https?:\/\//, '').split('.')[0] : null,
  urlSource: env.VITE_SUPABASE_URL
    ? 'VITE_SUPABASE_URL'
    : env.NEXT_PUBLIC_SUPABASE_URL
      ? 'NEXT_PUBLIC_SUPABASE_URL'
      : env.SUPABASE_URL
        ? 'SUPABASE_URL'
        : 'MISSING',
});

if (!url || !key) {
  console.error(
    '[Ares] Supabase URL / anon key are not set. Define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Vite requires the VITE_ prefix to expose them to the browser).'
  );
}

export const supabase = createClient(url, key);
