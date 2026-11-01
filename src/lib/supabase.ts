import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://dbakxdpudmfhrnhgyglq.supabase.co';

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-key-for-build';

export const isSupabaseConfigured = Boolean(
  (process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY) &&
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
);

// Global circuit breaker state so dead/paused Supabase instances fail-fast in 0ms
// instead of blocking serverless functions or causing 504 Gateway Timeouts.
declare global {
  var __CRICBID_SUPABASE_OFFLINE_UNTIL__: number | undefined;
}

const CIRCUIT_BREAKER_COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown on 522/timeout
const FAST_FETCH_TIMEOUT_MS = 650; // 650ms max wait before tripping circuit breaker

export function isSupabaseHealthy(): boolean {
  const offlineUntil = globalThis.__CRICBID_SUPABASE_OFFLINE_UNTIL__ || 0;
  return Date.now() >= offlineUntil;
}

export function tripSupabaseCircuitBreaker(): void {
  globalThis.__CRICBID_SUPABASE_OFFLINE_UNTIL__ = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
}

const resilientSupabaseFetch: typeof fetch = async (input, init) => {
  // 1. If circuit breaker is open, return immediate 503 JSON response in 0ms
  if (!isSupabaseHealthy()) {
    return new Response(
      JSON.stringify({ message: 'Supabase circuit breaker active (local fallback mode)', code: '503' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 2. Execute fetch with strict 550ms AbortController timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAST_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    // If Cloudflare / Supabase returns 502, 503, 504, 520-530 (e.g., 522 Connection timed out), trip breaker
    if (res.status >= 502) {
      tripSupabaseCircuitBreaker();
      return new Response(
        JSON.stringify({ message: `Supabase upstream error ${res.status}`, code: String(res.status) }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return res;
  } catch (err: any) {
    // Network timeout or abort -> trip circuit breaker for 2 minutes
    tripSupabaseCircuitBreaker();
    return new Response(
      JSON.stringify({ message: err?.message || 'Supabase fetch timeout', code: '504' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    clearTimeout(timer);
  }
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: resilientSupabaseFetch,
  },
});

/**
 * Executes a Promise with a strict timeout (default 600ms).
 * If the promise does not settle within the timeout, it resolves with fallbackVal or throws.
 * Guarantees serverless functions NEVER hang or hit 504 Gateway Timeout!
 */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 600,
  fallbackVal?: T
): Promise<T> {
  if (!isSupabaseHealthy() && fallbackVal !== undefined) {
    return fallbackVal;
  }
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      tripSupabaseCircuitBreaker();
      if (fallbackVal !== undefined) {
        resolve(fallbackVal);
      } else {
        reject(new Error(`Database operation timeout after ${ms}ms`));
      }
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (err) {
    if (fallbackVal !== undefined) return fallbackVal;
    throw err;
  } finally {
    clearTimeout(timer!);
  }
}
