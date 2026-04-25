import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

export async function createSupabaseServerClient() {
  const env = requirePublicEnv();
  if (!env) {
    return null;
  }

  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookieValues: { name: string; value: string; options: CookieOptions }[]) {
        cookieValues.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}

export function createSupabaseBrowserClient() {
  const env = requirePublicEnv();
  if (!env) {
    return null;
  }
  return createClient(env.url, env.anonKey);
}

export function createSupabaseAdminClient() {
  const env = requirePublicEnv();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceRole) {
    return null;
  }
  return createClient(env.url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
