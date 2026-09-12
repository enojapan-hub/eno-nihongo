import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const AUDIO_CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'

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
          .select('drive_file_id,status,structure_verified')
          .eq('id', id)
          .maybeSingle()

        if (error) {
          console.error('JLPT audio lookup failed', error)
          return Response.json({ error: 'Audio lookup failed' }, { status: 500 })
        }

        if (!data || !data.structure_verified || !['aligned', 'ready'].includes(data.status)) {
          return Response.json({ error: 'Audio not available' }, { status: 404 })
        }

        const sourceUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(data.drive_file_id)}&export=download&confirm=t`
        const range = request.headers.get('range')
        const sourceHeaders = new Headers()
        if (range) sourceHeaders.set('Range', range)

        let upstream: Response
        try {
          upstream = await fetch(sourceUrl, {
            method: 'GET',
            headers: sourceHeaders,
            redirect: 'follow',
          })
        } catch (fetchError) {
          console.error('JLPT Drive audio fetch failed', fetchError)
          return Response.json({ error: 'Audio source unavailable' }, { status: 502 })
        }

        if (!upstream.ok && upstream.status !== 206) {
          console.error('JLPT Drive audio returned', upstream.status)
          return Response.json({ error: 'Audio source unavailable' }, { status: 502 })
        }

        const headers = new Headers()
        headers.set('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg')
        headers.set('Cache-Control', AUDIO_CACHE)
        headers.set('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes')
        headers.set('X-Content-Type-Options', 'nosniff')

        const contentLength = upstream.headers.get('content-length')
        const contentRange = upstream.headers.get('content-range')
        if (contentLength) headers.set('Content-Length', contentLength)
        if (contentRange) headers.set('Content-Range', contentRange)

        return new Response(upstream.body, {
          status: upstream.status,
          headers,
        })
      },
    },
  },
})
