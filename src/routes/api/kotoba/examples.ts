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

type OpenAIContentPart = { type?: string; text?: string }
type OpenAIOutputItem = { content?: OpenAIContentPart[] }
type OpenAIResponse = { output?: OpenAIOutputItem[] }
type GeneratedExample = { jp: string; id: string; reading: string }
type GeneratedContent = {
  examples: GeneratedExample[]
  synonyms: string[]
  antonyms: string[]
  explanation: string
}

type VocabularyRow = {
  id: string
  term: string
  reading: string | null
  meaning_id: string | null
  part_of_speech: string | null
  level: string | null
  examples: unknown
}

function isGeneratedExample(value: unknown): value is GeneratedExample {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.jp === 'string' && typeof item.id === 'string' && typeof item.reading === 'string'
}

function parseExamples(value: unknown): GeneratedExample[] {
  return Array.isArray(value) ? value.filter(isGeneratedExample) : []
}

async function generateContent(vocab: VocabularyRow): Promise<GeneratedContent> {
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
  const data = await response.json() as OpenAIResponse
  const outputText = data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text
  if (!outputText) throw new Error('OpenAI returned no output text')
  const parsed = JSON.parse(outputText) as Record<string, unknown>
  const examples = parseExamples(parsed.examples)
  if (examples.length !== 3 || !Array.isArray(parsed.synonyms) || !Array.isArray(parsed.antonyms) || typeof parsed.explanation !== 'string') throw new Error('Invalid Kotoba response')
  return {
    examples,
    synonyms: parsed.synonyms.filter((item): item is string => typeof item === 'string').slice(0, 4),
    antonyms: parsed.antonyms.filter((item): item is string => typeof item === 'string').slice(0, 4),
    explanation: parsed.explanation,
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

  const { data: vocabData, error } = await supabaseAdmin
    .from('vocabulary')
    .select('id, term, reading, meaning_id, part_of_speech, level, examples')
    .eq('id', body.id)
    .eq('is_published', true)
    .maybeSingle()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!vocabData) return Response.json({ error: 'Vocabulary not found' }, { status: 404 })

  const vocab = vocabData as VocabularyRow
  const existing = parseExamples(vocab.examples)
  if (existing.length >= 3) {
    return Response.json({ examples: existing.slice(0, 3), synonyms: [], antonyms: [], explanation: '', generated: false })
  }

  try {
    const content = await generateContent(vocab)
    const { error: updateError } = await supabaseAdmin
      .from('vocabulary')
      .update({ examples: content.examples })
      .eq('id', body.id)
    if (updateError) throw new Error(`Failed to save examples: ${updateError.message}`)
    return Response.json({ ...content, generated: true })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Generation failed' }, { status: 502 })
  }
} } } })
