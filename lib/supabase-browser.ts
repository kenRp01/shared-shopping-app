import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type SupabaseDatabase = any;

let browserClient: SupabaseClient<SupabaseDatabase> | null = null;

function requirePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function hasSupabaseEnv(): boolean {
  return Boolean(requirePublicEnv());
}

export function createSupabaseBrowserClient() {
  const env = requirePublicEnv();
  if (!env) {
    return null;
  }
  if (!browserClient) {
    browserClient = createClient<SupabaseDatabase>(env.url, env.anonKey);
  }
  return browserClient;
}
