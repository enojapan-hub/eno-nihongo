import { createClient } from "@supabase/supabase-js";

function createSupabaseAdminClient() {
  const url = process.env["SUPABASE_URL"] || "https://upxtqsvgppvqpbrjoitz.supabase.co";
  const secretKey = process.env["SUPABASE_SECRET_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!secretKey) {
    throw new Error("Missing server-only Supabase secret key");
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Created on first use so a missing secret only fails the routes that need it,
// not every server-rendered page that shares this bundle.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
