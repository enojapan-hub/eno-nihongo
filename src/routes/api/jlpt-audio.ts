import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const REDIRECT_CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'

export const Route = createFileRoute('/api/jlpt-audio')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const id = url.searchParams.get('id')?.trim()

        if (!id) {
          return Response.json({ error: 'Missing audio id' }, { status: 400 })
        }

        const { data, error } = await (supabaseAdmin as any)
          .from('jlpt_simulation_audio_source_map')
          .select('drive_file_id,status,structure_verified,delivery_path')
          .eq('id', id)
          .maybeSingle()

        if (error) {
          console.error('JLPT audio lookup failed', error)
          return Response.json({ error: 'Audio lookup failed' }, { status: 500 })
        }

        if (!data || !data.structure_verified || !['aligned', 'ready'].includes(data.status)) {
          return Response.json({ error: 'Audio not available' }, { status: 404 })
        }

        // Prefer a CDN/storage URL once a source has been migrated. This keeps
        // the route compatible with the Supabase Storage rollout without
        // another frontend change.
        const deliveryPath = typeof data.delivery_path === 'string' ? data.delivery_path.trim() : ''
        if (/^https:\/\//i.test(deliveryPath)) {
          return new Response(null, {
            status: 307,
            headers: {
              Location: deliveryPath,
              'Cache-Control': REDIRECT_CACHE,
              'X-Content-Type-Options': 'nosniff',
            },
          })
        }

        // Drive is the temporary fallback. Redirect the browser instead of
        // proxying the MP3 body through the Vercel function. Proxy streaming
        // kept the serverless invocation open for the full audio transfer and
        // could surface as Gateway Timeout even though the DB lookup was fast.
        const sourceUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(data.drive_file_id)}&export=download&confirm=t`
        return new Response(null, {
          status: 307,
          headers: {
            Location: sourceUrl,
            'Cache-Control': REDIRECT_CACHE,
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
