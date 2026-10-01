import { createFileRoute } from '@tanstack/react-router'
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth'
import { runTranslationBatch } from '@/lib/translation.server'

export const Route = createFileRoute('/api/cron/translation')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authError = await authenticateCronRequest(request)
        if (authError) return authError

        try {
          const result = await runTranslationBatch('kanji', 100)
          return Response.json({ ok: true, ...result })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return Response.json({ ok: false, error: message }, { status: 500 })
        }
      },
    },
  },
})
