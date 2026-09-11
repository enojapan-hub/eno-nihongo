import { supabaseAdmin } from './supabase.server'

type SourceType = 'kanji' | 'vocabulary' | 'grammar' | 'reading'

type TranslationResult = {
  translation: string
  provider: 'gemini'
  model: string
}

type GeminiPart = { text?: string }
type GeminiResponse = { candidates?: Array<{ content?: { parts?: GeminiPart[] } }> }
type BatchTranslation = { id: string; translation: string }
type BatchTranslationResponse = { translations?: BatchTranslation[] }
type TranslationRow = Record<string, unknown> & { id: string }

const MAX_ATTEMPTS = 3
const DEFAULT_LIMIT = 10
const DISCOVERY_PAGE_SIZE = 100
const MAX_BATCH_SIZE = 100

function looksIndonesian(text: string | null | undefined) {
  if (!text) return false
  const value = text.trim().toLowerCase()
  if (!value) return false
  return /\b(yang|dan|dengan|untuk|dari|dalam|adalah|artinya|kata|contoh|penjelasan|membuat|menjadi|atau|sebagai|karena|jika|ketika|sudah|belum)\b/.test(value)
}

function looksJapanese(text: string | null | undefined) {
  if (!text) return false
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text)
}

function extractJsonTranslation(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as { translation?: unknown }
    if (typeof parsed.translation === 'string') return parsed.translation.trim()
  } catch {
    const match = cleaned.match(/"translation"\s*:\s*"((?:\\.|[^"\\])*)"/s)
    if (match) {
      try {
        return JSON.parse(`"${match[1]}"`).trim()
      } catch {
        return match[1].trim()
      }
    }
  }
  return cleaned
}

const TRANSLATION_SYSTEM = `Anda adalah editor materi pembelajaran bahasa Jepang ENO JAPAN. Terjemahkan ke Bahasa Indonesia yang natural, ringkas, jelas, dan mudah dipahami pelajar JLPT. Untuk arti kanji, gunakan padanan Bahasa Indonesia yang lazim dan mudah dipahami, bukan terjemahan kata-per-kata yang kaku. Pertahankan istilah Jepang, kanji, kana, contoh bahasa Jepang, angka, nama, dan simbol apa adanya jika muncul. Jangan menambahkan informasi yang tidak ada. Kembalikan hanya JSON sesuai schema.`

async function translateWithGemini(text: string, context: string): Promise<TranslationResult> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_TRANSLATION_MODEL || 'gemini-2.5-flash-lite'
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: TRANSLATION_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `Konteks materi: ${context}\n\nTeks sumber:\n${text}` }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { translation: { type: 'STRING' } },
          required: ['translation'],
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Gemini ${response.status}: ${body.slice(0, 500)}`)
  }

  const data = (await response.json()) as GeminiResponse
  const raw = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').filter(Boolean).join('') || ''
  const translation = extractJsonTranslation(raw)
  if (!translation) throw new Error('Gemini returned empty translation')
  return { translation, provider: 'gemini', model }
}

async function translateBatchWithGemini(items: Array<{ id: string; text: string }>, context: string) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_TRANSLATION_MODEL || 'gemini-2.5-flash-lite'
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: TRANSLATION_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `Konteks materi: ${context}\n\nTerjemahkan SEMUA item berikut ke Bahasa Indonesia. Pertahankan urutan dan ID. Setiap item harus mendapat satu terjemahan natural. Jangan menghilangkan atau menggabungkan item.\n\n${JSON.stringify(items)}` }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            translations: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  id: { type: 'STRING' },
                  translation: { type: 'STRING' },
                },
                required: ['id', 'translation'],
              },
            },
          },
          required: ['translations'],
        },
      },
    }),
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Gemini ${response.status}: ${body.slice(0, 500)}`)
  }

  const data = (await response.json()) as GeminiResponse
  const raw = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').filter(Boolean).join('') || ''
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as BatchTranslationResponse
  const translations = Array.isArray(parsed.translations) ? parsed.translations : []
  if (!translations.length) throw new Error('Gemini returned no batch translations')
  return { translations, model }
}

async function translateNaturalIndonesian(text: string, context: string): Promise<TranslationResult> {
  return translateWithGemini(text, context)
}

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

export async function getTranslationStats() {
  const [kanji, vocabulary, grammar, reading] = await Promise.all([
    supabaseAdmin.from('kanji').select('id, meaning_en, meaning_id', { count: 'exact', head: true }).eq('is_published', true),
    supabaseAdmin.from('vocabulary').select('id, meaning_en, meaning_id', { count: 'exact', head: true }).eq('is_published', true),
    supabaseAdmin.from('grammar_points').select('id, meaning_en, meaning_id', { count: 'exact', head: true }).eq('is_published', true),
    supabaseAdmin.from('reading_passages').select('id, translation_en, translation_id', { count: 'exact', head: true }).eq('is_published', true),
  ])
  return {
    kanji: kanji.count || 0,
    vocabulary: vocabulary.count || 0,
    grammar: grammar.count || 0,
    reading: reading.count || 0,
  }
}

async function discoverWork(sourceType: SourceType, limit: number): Promise<TranslationRow[]> {
  const table = sourceType === 'kanji' ? 'kanji' : sourceType === 'vocabulary' ? 'vocabulary' : sourceType === 'grammar' ? 'grammar_points' : 'reading_passages'
  const sourceColumn = sourceType === 'reading' ? 'translation_en' : 'meaning_en'
  const targetColumn = sourceType === 'reading' ? 'translation_id' : 'meaning_id'
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(`id, ${sourceColumn}, ${targetColumn}`)
    .eq('is_published', true)
    .not(sourceColumn, 'is', null)
    .order('id')
    .limit(Math.min(Math.max(limit, 1), DISCOVERY_PAGE_SIZE))
  if (error) throw error
  return ((data || []) as TranslationRow[]).filter(row => {
    const source = row[sourceColumn] as string | null
    const target = row[targetColumn] as string | null
    if (!source || !source.trim()) return false
    if (!target || !target.trim()) return true
    if (target.trim() === source.trim() && !looksJapanese(source)) return true
    return false
  })
}

async function translateOne(sourceType: SourceType, row: TranslationRow): Promise<TranslationResult> {
  const table = sourceType === 'kanji' ? 'kanji' : sourceType === 'vocabulary' ? 'vocabulary' : sourceType === 'grammar' ? 'grammar_points' : 'reading_passages'
  const sourceColumn = sourceType === 'reading' ? 'translation_en' : 'meaning_en'
  const targetColumn = sourceType === 'reading' ? 'translation_id' : 'meaning_id'
  const context = sourceType === 'kanji' ? 'Kanji JLPT' : sourceType === 'vocabulary' ? 'Kosakata JLPT' : sourceType === 'grammar' ? 'Bunpou JLPT' : 'Dokkai JLPT'
  const source = row[sourceColumn]
  if (typeof source !== 'string') throw new Error(`Missing translation source for ${row.id}`)
  const result = await translateNaturalIndonesian(source, context)
  const { error } = await supabaseAdmin.from(table).update({ [targetColumn]: result.translation }).eq('id', row.id)
  if (error) throw error
  return result
}

export async function runTranslationBatch(sourceType: SourceType, requestedLimit = DEFAULT_LIMIT) {
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_BATCH_SIZE)
  const rows = await discoverWork(sourceType, limit)
  if (!rows.length) return { sourceType, requested: limit, processed: 0, results: [] }

  const table = sourceType === 'kanji' ? 'kanji' : sourceType === 'vocabulary' ? 'vocabulary' : sourceType === 'grammar' ? 'grammar_points' : 'reading_passages'
  const sourceColumn = sourceType === 'reading' ? 'translation_en' : 'meaning_en'
  const targetColumn = sourceType === 'reading' ? 'translation_id' : 'meaning_id'
  const context = sourceType === 'kanji' ? 'Kanji JLPT' : sourceType === 'vocabulary' ? 'Kosakata JLPT' : sourceType === 'grammar' ? 'Bunpou JLPT' : 'Dokkai JLPT'

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const items = rows.map(row => {
        const text = row[sourceColumn]
        if (typeof text !== 'string') throw new Error(`Missing translation source for ${row.id}`)
        return { id: row.id, text }
      })
      const batch = await translateBatchWithGemini(items, context)
      const byId = new Map(batch.translations.map(item => [String(item.id), String(item.translation || '').trim()]))
      const results: Array<{ id: string; translation: string; provider: string; model: string }> = []

      for (const row of rows) {
        const translation = byId.get(String(row.id))
        if (!translation) throw new Error(`Gemini missing translation for ${row.id}`)
        const { error } = await supabaseAdmin.from(table).update({ [targetColumn]: translation }).eq('id', row.id)
        if (error) throw error
        results.push({ id: row.id, translation, provider: 'gemini', model: batch.model })
      }

      return { sourceType, requested: limit, processed: results.length, results }
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, attempt * 1000))
    }
  }

  throw lastError
}

export async function authorizeTranslationRequest(userId: string) {
  if (!userId) throw new Error('Unauthorized')
  if (!(await isAdmin(userId))) throw new Error('Admin access required')
  return true
}
