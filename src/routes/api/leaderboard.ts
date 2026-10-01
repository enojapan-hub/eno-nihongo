import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/leaderboard')({
  server: { handlers: { GET: async ({ request }) => {
    const authorization = request.headers.get('authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !auth.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') ?? 50), 1), 100)
    const client = (supabaseAdmin as any)
    const { data, error } = await client.rpc('get_leaderboard', { p_limit: limit })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ leaderboard: data ?? [] })
  } } },
})
