import { createFileRoute } from '@tanstack/react-router'

const IMAGE_CACHE = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
const ALLOWED_IMAGE_IDS = new Set([
  '1ZAP_hLEs8XnnZq_aoyxBqwYhLqD4dBi9',
  '1l_dqKz19zm_ue_QrwzoB-VJSoB5zDFsd',
  '1ZwE4Z7KrL-DMONIwxE7Dtg_Pl7cW5y1K',
  '1nnsKVZbQekC0hbrvCR7ePNcA7kznEPCm',
  '1D5FCBI8cFGKvKFLVfCe-aX5krddYov6J',
  '1T7YBrG3xUqsTUVvw2CfbVF5SNLQw32Ed',
  '1n7uuOeCPCsvQYrNu9fYKeA2mQzVEsu75',
  '1yhI5RT76oOpRzDoh_FbC1Ak3H6NZEKaf',
  '190Rh2aG_7umo2_v0SHxG61-2jfNnH7IZ',
  '1bfqHxwSAZky_oIbgK-XgE6jeCfdX0IoZ',
  '1eal-PduKFl_H356pMVU8RLeopppxkyDT',
  '1SpUNUfIawYWgFoNLhaF8reIRF11VYPuJ',
  '1KhBl5HLohMttYlAFOV1iKGgJ2bMNoH5M',
  '1BiN2r7JxYAfq3YwpjDmlTTkRYkUOqVqo',
  '14ykuLqKR__w8m4Q_3d7bN-luK-v0eJEX',
  '1lhrsIBQKzinl0FyvvdVMwJM-ckolketW',
  '1hFmoNMjlMhQ_0I6GhVImTkQ_OLW_1Vo3',
  '1tyLMzP4wxrSYlK1OFcjRTxRAQ4Xti1xF',
  '1_yFru5C_4juZpLniCyybr5JAEFTrYrqx',
  '1YdFL75fEPM8GapH_Y-mcYDcyC6qYim7C',
  '1xNqbhgANibATwvBgtm1OQ61QIHfs4dQv',
  '1LbNDQ69ksjrCwk0RD1alYM4HQnG2_H6A',
  '1q3xq5vCNEBIx99fTJoECfSiyEIcZ4xfw',
  '1j0qeueguTfV80gb7E8_--wqNabN6S9hB',
  '1n1y6S7G5b2n8y4QW_2DgAVy6ry5cpz1J',
  '11BFs2Rob8H_7pPqPkiAfMkSSL5FstfER',
  '1lf_OHa87t80fKAjhrjRIKJ-zKbkeBakT',
  '1oBnO-qJ_hX39XraInz8lKAHmJOI8cfLI',
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
