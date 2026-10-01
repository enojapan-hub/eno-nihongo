import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const routeSchema = {
  type: 'object',
  properties: {
    examples: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', properties: { jp: { type: 'string' }, id: { type: 'string' }, reading: { type: 'string' } }, required: ['jp', 'id', 'reading'], additionalProperties: false } },
    synonyms: { type: 'array', items: { type: 'string' } },
    antonyms: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
  },
  required: ['examples', 'synonyms', 'antonyms', 'explanation'], additionalProperties: false,
} as const

async function generateContent(vocab: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_TRANSLATION_MODEL
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
  if (!model) throw new Error('Missing OPENAI_TRANSLATION_MODEL')

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, store: false, input: [
      { role: 'system', content: 'Anda adalah editor materi JLPT ENO JAPAN. Buat tepat 3 contoh kalimat Jepang natural dengan reading hiragana seluruh kalimat dan terjemahan Indonesia natural. Explanation harus spesifik terhadap kata target: arti, kelas kata, penggunaan, nuansa, konteks, dan perbedaan dengan kata mirip bila relevan. Buat 2-4 sinonim dan 1-4 antonim hanya jika benar-benar relevan; jangan memaksakan relasi yang salah. Gunakan Bahasa Indonesia natural. Jangan gunakan template generik.' },
      { role: 'user', content: JSON.stringify({ target: vocab.term, reading: vocab.reading, meaning: vocab.meaning_id, partOfSpeech: vocab.part_of_speech, level: vocab.level }) },
    ], text: { format: { type: 'json_schema', name: 'kotoba_content', strict: true, schema: routeSchema } } }),
  })
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 500)}`)
  const data = await response.json()
  const outputText = data.output?.flatMap((item: any) => item.content ?? [])?.find((item: any) => item.type === 'output_text')?.text
  if (!outputText) throw new Error('OpenAI returned no output text')
  const parsed = JSON.parse(outputText)
  if (!Array.isArray(parsed.examples) || parsed.examples.length !== 3 || !Array.isArray(parsed.synonyms) || !Array.isArray(parsed.antonyms) || typeof parsed.explanation !== 'string') throw new Error('Invalid Kotoba response')
  return {
    examples: parsed.examples.map((x: any) => ({ jp: String(x.jp), id: String(x.id), reading: String(x.reading) })),
    synonyms: parsed.synonyms.map(String).slice(0, 4),
    antonyms: parsed.antonyms.map(String).slice(0, 4),
    explanation: String(parsed.explanation),
  }
}

export const Route = createFileRoute('/api/kotoba/examples')({ server: { handlers: { POST: async ({ request }) => {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !auth.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { id?: string } | null
  if (!body?.id) return Response.json({ error: 'Missing vocabulary id' }, { status: 400 })
  const { data: vocab, error } = await (supabaseAdmin as any).from('vocabulary').select('id, term, reading, meaning_id, part_of_speech, level, examples, explanation').eq('id', body.id).eq('is_published', true).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!vocab) return Response.json({ error: 'Vocabulary not found' }, { status: 404 })

  const { data: cached } = await (supabaseAdmin as any).from('ai_learning_content').select('examples, synonyms, antonyms, explanation').eq('content_type', 'kotoba').eq('content_id', body.id).eq('language', 'id').maybeSingle()
  if (cached && Array.isArray(cached.examples) && cached.examples.length >= 3) return Response.json({ examples: cached.examples.slice(0, 3), synonyms: cached.synonyms ?? [], antonyms: cached.antonyms ?? [], explanation: cached.explanation ?? vocab.explanation ?? '', generated: false })

  const existing = Array.isArray(vocab.examples) ? vocab.examples : []
  if (existing.length >= 3 && vocab.explanation) return Response.json({ examples: existing.slice(0, 3), synonyms: [], antonyms: [], explanation: vocab.explanation, generated: false })

  try {
    const content = await generateContent(vocab)
    await (supabaseAdmin as any).from('vocabulary').update({ examples: content.examples, explanation: content.explanation }).eq('id', body.id)
    await (supabaseAdmin as any).from('ai_learning_content').upsert({ content_type: 'kotoba', content_id: body.id, language: 'id', examples: content.examples, synonyms: content.synonyms, antonyms: content.antonyms, explanation: content.explanation, model, updated_at: new Date().toISOString() }, { onConflict: 'content_type,content_id,language' })
    return Response.json({ ...content, generated: true })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 502 })
  }
} } } })
