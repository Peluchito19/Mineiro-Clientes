import { createBrowserClient } from "@supabase/ssr";

let cachedClient = null;

export const getSupabaseClient = () => {
  if (cachedClient) return cachedClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window !== "undefined") {
      console.warn(
        "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }
    return null;
  }

  cachedClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
};

// Alias for backwards compatibility
export const supabase = typeof window !== "undefined" ? getSupabaseClient() : null;
