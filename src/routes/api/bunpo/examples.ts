import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

const schema = {
  type: 'object', properties: {
    examples: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', properties: { jp: { type: 'string' }, id: { type: 'string' }, reading: { type: 'string' } }, required: ['jp','id','reading'], additionalProperties: false } },
    synonyms: { type: 'array', items: { type: 'string' } }, antonyms: { type: 'array', items: { type: 'string' } }, explanation: { type: 'string' },
  }, required: ['examples','synonyms','antonyms','explanation'], additionalProperties: false,
} as const

async function generateContent(grammar: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_TRANSLATION_MODEL
  if (!apiKey || !model) throw new Error('OpenAI configuration is missing')
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, store: false, input: [
    { role: 'system', content: 'Anda adalah editor materi JLPT ENO JAPAN. Buat tepat 3 contoh kalimat Jepang natural untuk pola tata bahasa, masing-masing dengan reading hiragana seluruh kalimat dan terjemahan Indonesia natural. Explanation harus spesifik terhadap pola: makna, struktur, penggunaan, nuansa, konteks, dan perbedaan dengan pola mirip. Berikan 2-4 sinonim/pola terkait dan 1-4 antonim/pola berlawanan hanya jika benar-benar relevan. Jangan memaksakan relasi yang salah.' },
    { role: 'user', content: JSON.stringify({ pattern: grammar.pattern, meaning: grammar.meaning_id, structure: grammar.structure, level: grammar.level }) },
  ], text: { format: { type: 'json_schema', name: 'bunpo_content', strict: true, schema } } }) })
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0,500)}`)
  const data = await response.json()
  const outputText = data.output?.flatMap((item: any) => item.content ?? [])?.find((item: any) => item.type === 'output_text')?.text
  if (!outputText) throw new Error('OpenAI returned no output text')
  const parsed = JSON.parse(outputText)
  if (!Array.isArray(parsed.examples) || parsed.examples.length !== 3) throw new Error('Invalid examples')
  return { examples: parsed.examples.map((x: any) => ({ jp: String(x.jp), id: String(x.id), reading: String(x.reading) })), synonyms: (parsed.synonyms ?? []).map(String).slice(0,4), antonyms: (parsed.antonyms ?? []).map(String).slice(0,4), explanation: String(parsed.explanation), model }
}

export const Route = createFileRoute('/api/bunpo/examples')({ server: { handlers: { POST: async ({ request }) => {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !auth.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { id?: string } | null
  if (!body?.id) return Response.json({ error: 'Missing grammar id' }, { status: 400 })
  const { data: grammar, error } = await (supabaseAdmin as any).from('grammar_points').select('id, pattern, meaning_id, structure, level, examples, explanation_id').eq('id', body.id).eq('is_published', true).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!grammar) return Response.json({ error: 'Grammar not found' }, { status: 404 })

  const { data: cached } = await (supabaseAdmin as any).from('ai_learning_content').select('examples, synonyms, antonyms, explanation').eq('content_type', 'bunpou').eq('content_id', body.id).eq('language', 'id').maybeSingle()
  if (cached && Array.isArray(cached.examples) && cached.examples.length >= 3) return Response.json({ examples: cached.examples.slice(0,3), synonyms: cached.synonyms ?? [], antonyms: cached.antonyms ?? [], explanation: cached.explanation ?? grammar.explanation_id ?? '', generated: false })

  const existing = Array.isArray(grammar.examples) ? grammar.examples : []
  if (existing.length >= 3 && grammar.explanation_id) return Response.json({ examples: existing.slice(0,3), synonyms: [], antonyms: [], explanation: grammar.explanation_id, generated: false })
  try {
    const content = await generateContent(grammar)
    await (supabaseAdmin as any).from('grammar_points').update({ examples: content.examples, explanation_id: content.explanation }).eq('id', body.id)
    await (supabaseAdmin as any).from('ai_learning_content').upsert({ content_type: 'bunpou', content_id: body.id, language: 'id', examples: content.examples, synonyms: content.synonyms, antonyms: content.antonyms, explanation: content.explanation, model: content.model, updated_at: new Date().toISOString() }, { onConflict: 'content_type,content_id,language' })
    return Response.json({ examples: content.examples, synonyms: content.synonyms, antonyms: content.antonyms, explanation: content.explanation, generated: true })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 502 })
  }
} } } })
