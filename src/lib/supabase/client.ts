import { createClient } from "@supabase/supabase-js";

import { AUTH_REQUIRED } from "@/lib/supabase/access";

/** 公开的 publishable key，可以放进前端。不要把 service_role 或 secret key 放进来。 */
const DEFAULT_SUPABASE_URL = "https://vpsemuqatdafmezsawbe.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Ap_wHtBZhs75rdcTZEVEsA_JnlQ-Isl";

function configured(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export const supabaseUrl = configured(import.meta.env.VITE_SUPABASE_URL, DEFAULT_SUPABASE_URL);
export const supabasePublishableKey = configured(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  DEFAULT_SUPABASE_PUBLISHABLE_KEY,
);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: AUTH_REQUIRED,
    autoRefreshToken: AUTH_REQUIRED,
    detectSessionInUrl: AUTH_REQUIRED,
  },
});
