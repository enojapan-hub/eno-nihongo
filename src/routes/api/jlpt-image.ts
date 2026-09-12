import { createFileRoute } from '@tanstack/react-router'

const IMAGE_CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
const ALLOWED_IMAGE_IDS = new Set([
  '1ZAP_hLEs8XnnZq_aoyxBqwYhLqD4dBi9',
  '1l_dqKz19zm_ue_QrwzoB-VJSoB5zDFsd',
  '1ZwE4Z7KrL-DMONIwxE7Dtg_Pl7cW5y1K',
  '1nnsKVZbQekC0hbrvCR7ePNcA7kznEPCm',
  '1D5FCBI8cFGKvKFLVfCe-aX5krddYov6J',
  '1T7YBrG3xUqsTUVvw2CfbVF5SNLQw32Ed',
])

export const Route = createFileRoute('/api/jlpt-image')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const id = url.searchParams.get('id')?.trim()

        if (!id || !ALLOWED_IMAGE_IDS.has(id)) {
          return Response.json({ error: 'Image not available' }, { status: 404 })
        }

        const sourceUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`
        let upstream: Response
        try {
          upstream = await fetch(sourceUrl, { method: 'GET', redirect: 'follow' })
        } catch (fetchError) {
          console.error('JLPT Drive image fetch failed', fetchError)
          return Response.json({ error: 'Image source unavailable' }, { status: 502 })
        }

        if (!upstream.ok) {
          console.error('JLPT Drive image returned', upstream.status)
          return Response.json({ error: 'Image source unavailable' }, { status: 502 })
        }

        const headers = new Headers()
        headers.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
        headers.set('Cache-Control', IMAGE_CACHE)
        headers.set('X-Content-Type-Options', 'nosniff')
        const contentLength = upstream.headers.get('content-length')
        if (contentLength) headers.set('Content-Length', contentLength)

        return new Response(upstream.body, { status: 200, headers })
      },
    },
  },
})
