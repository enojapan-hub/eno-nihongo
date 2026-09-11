import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import type { Database, Json } from '@/integrations/supabase/types'

type GrammarRow = Pick<Database['public']['Tables']['grammar_points']['Row'], 'id' | 'pattern' | 'meaning_id' | 'structure' | 'level' | 'examples' | 'explanation_id'>
type Example = { jp: string; id: string; reading: string }
type GeneratedContent = { examples: Example[]; synonyms: string[]; antonyms: string[]; explanation: string }
type OpenAIContent = { type?: string; text?: string }
type OpenAIOutput = { content?: OpenAIContent[] }
type OpenAIResponse = { output?: OpenAIOutput[] }

const schema = {
  type: 'object', properties: {
    examples: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', properties: { jp: { type: 'string' }, id: { type: 'string' }, reading: { type: 'string' } }, required: ['jp','id','reading'], additionalProperties: false } },
    synonyms: { type: 'array', items: { type: 'string' } }, antonyms: { type: 'array', items: { type: 'string' } }, explanation: { type: 'string' },
  }, required: ['examples','synonyms','antonyms','explanation'], additionalProperties: false,
} as const

function parseGeneratedContent(value: unknown): GeneratedContent {
  if (!value || typeof value !== 'object') throw new Error('Invalid Bunpou response')
  const parsed = value as Record<string, unknown>
  if (!Array.isArray(parsed.examples) || parsed.examples.length !== 3 || !Array.isArray(parsed.synonyms) || !Array.isArray(parsed.antonyms) || typeof parsed.explanation !== 'string') throw new Error('Invalid Bunpou response')
  const examples = parsed.examples.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid Bunpou example')
    const example = item as Record<string, unknown>
    if (typeof example.jp !== 'string' || typeof example.id !== 'string' || typeof example.reading !== 'string') throw new Error('Invalid Bunpou example')
    return { jp: example.jp, id: example.id, reading: example.reading }
  })
  return { examples, synonyms: parsed.synonyms.map(String).slice(0, 4), antonyms: parsed.antonyms.map(String).slice(0, 4), explanation: parsed.explanation }
}

async function generateContent(grammar: GrammarRow): Promise<GeneratedContent> {
  const apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_TRANSLATION_MODEL
  if (!apiKey || !model) throw new Error('OpenAI configuration is missing')
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, store: false, input: [
    { role: 'system', content: 'Anda adalah editor materi JLPT ENO JAPAN. Buat tepat 3 contoh kalimat Jepang natural untuk pola tata bahasa, masing-masing dengan reading hiragana seluruh kalimat dan terjemahan Indonesia natural. Explanation harus spesifik terhadap pola: makna, struktur, penggunaan, nuansa, konteks, dan perbedaan dengan pola mirip. Berikan 2-4 sinonim/pola terkait dan 1-4 antonim/pola berlawanan hanya jika benar-benar relevan. Jangan memaksakan relasi yang salah.' },
    { role: 'user', content: JSON.stringify({ pattern: grammar.pattern, meaning: grammar.meaning_id, structure: grammar.structure, level: grammar.level }) },
  ], text: { format: { type: 'json_schema', name: 'bunpo_content', strict: true, schema } } }) })
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0,500)}`)
  const data = await response.json() as OpenAIResponse
  const outputText = data.output?.flatMap(item => item.content ?? []).find(item => item.type === 'output_text')?.text
  if (!outputText) throw new Error('OpenAI returned no output text')
  return parseGeneratedContent(JSON.parse(outputText) as unknown)
}

export const Route = createFileRoute('/api/bunpo/examples')({ server: { handlers: { POST: async ({ request }) => {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !auth.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => null) as { id?: string } | null
  if (!body?.id) return Response.json({ error: 'Missing grammar id' }, { status: 400 })
  const { data: grammar, error } = await supabaseAdmin.from('grammar_points').select('id, pattern, meaning_id, structure, level, examples, explanation_id').eq('id', body.id).eq('is_published', true).maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!grammar) return Response.json({ error: 'Grammar not found' }, { status: 404 })

  const existing = Array.isArray(grammar.examples) ? grammar.examples : []
  if (existing.length >= 3 && grammar.explanation_id) return Response.json({ examples: existing.slice(0,3), synonyms: [], antonyms: [], explanation: grammar.explanation_id, generated: false })
  try {
    const content = await generateContent(grammar)
    const { error: updateError } = await supabaseAdmin.from('grammar_points').update({ examples: content.examples as Json, explanation_id: content.explanation }).eq('id', body.id)
    if (updateError) throw updateError
    return Response.json({ examples: content.examples, synonyms: content.synonyms, antonyms: content.antonyms, explanation: content.explanation, generated: true })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 502 })
  }
} } } })
