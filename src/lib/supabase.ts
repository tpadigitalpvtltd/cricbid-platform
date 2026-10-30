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

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Executes a Promise with a strict timeout (default 2500ms).
 * If the promise does not settle within the timeout, it resolves with fallbackVal or throws.
 * This guarantees Vercel serverless functions NEVER hang or hit 504 Gateway Timeout!
 */
export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 2500,
  fallbackVal?: T
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
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
