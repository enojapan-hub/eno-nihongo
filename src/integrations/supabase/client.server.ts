// Server-side Supabase client.
// Privileged server operations must use a server-only secret key.
// Never fall back to the public publishable key for admin/database operations.
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const FALLBACK_SUPABASE_URL = 'https://upxtqsvgppvqpbrjoitz.supabase.co'

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    )
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization')
    }
    headers.set('apikey', supabaseKey)
    return fetch(input, { ...init, headers })
  }
}

function createSupabaseServerClient() {
  const url = process.env['SUPABASE_URL'] || FALLBACK_SUPABASE_URL
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || process.env['SUPABASE_SECRET_KEY']

  if (!url) throw new Error('Missing SUPABASE_URL')
  if (!serviceRoleKey) {
    throw new Error('Missing server-only Supabase secret key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY)')
  }

  return createClient<Database>(url, serviceRoleKey, {
    global: { fetch: createSupabaseFetch(serviceRoleKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  })
}

let _supabaseServer: ReturnType<typeof createSupabaseServerClient> | undefined

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseServerClient>, {
  get(_, prop, receiver) {
    if (!_supabaseServer) _supabaseServer = createSupabaseServerClient()
    return Reflect.get(_supabaseServer, prop, receiver)
  },
})
