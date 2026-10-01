import { supabaseAdmin } from './supabase.server'

const MODEL = process.env.GEMINI_TRANSLATION_MODEL || 'gemini-2.5-flash-lite'
const SYSTEM = `Anda adalah editor soal JLPT ENO NIHONGO. Terjemahkan hanya bagian berbahasa Inggris ke Bahasa Indonesia yang natural dan ringkas. Pertahankan semua teks Jepang (kanji, hiragana, katakana), nama, angka, simbol, dan struktur soal. Jangan mengubah jawaban benar, urutan pilihan, atau menambah informasi. Pilihan jawaban yang berupa arti bahasa Inggris harus diterjemahkan ke Bahasa Indonesia. Kembalikan JSON sesuai schema.`

type QuestionRow = {
  id: string
  level: string
  skill: string
  prompt_en: string | null
  choices_en: unknown
  explanation_id: string | null
  explanation_en: string | null
}

type Translated = {
  id: string
  prompt_id: string
  choices_id: string[]
  explanation_id: string | null
}

export async function runQuestionTranslationBatch(limit = 100) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

  const { data, error } = await supabaseAdmin
    .from('questions')
    .select('id, level, skill, prompt_en, choices_en, explanation_id, explanation_en, prompt_id, choices_id')
    .eq('is_published', true)
    .or('prompt_id.is.null,choices_id.is.null')
    .order('level')
    .order('skill')
    .order('id')
    .limit(Math.min(Math.max(limit, 1), 100))
  if (error) throw error

  const rows = (data ?? []) as QuestionRow[]
  if (!rows.length) return { requested: limit, processed: 0, remaining: 0 }

  const items = rows.map((q) => ({
    id: q.id,
    level: q.level,
    skill: q.skill,
    prompt: q.prompt_en || '',
    choices: Array.isArray(q.choices_en) ? q.choices_en.map(String) : [],
    explanation: q.explanation_en || q.explanation_id || null,
  }))

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `Terjemahkan semua soal berikut. Setiap item harus tetap memiliki ID yang sama, 4 pilihan dalam urutan yang sama, dan teks Jepang harus tetap apa adanya.\n\n${JSON.stringify(items)}` }] }],
      generationConfig: {
        temperature: 0.15,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            questions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  id: { type: 'STRING' },
                  prompt_id: { type: 'STRING' },
                  choices_id: { type: 'ARRAY', items: { type: 'STRING' } },
                  explanation_id: { type: 'STRING', nullable: true },
                },
                required: ['id', 'prompt_id', 'choices_id'],
              },
            },
          },
          required: ['questions'],
        },
      },
    }),
    signal: AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Gemini ${response.status}: ${body.slice(0, 500)}`)
  }

  const json = await response.json()
  const raw = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || ''
  const parsed = JSON.parse(raw)
  const translated = (Array.isArray(parsed?.questions) ? parsed.questions : []) as Translated[]
  const byId = new Map(translated.map((q) => [q.id, q]))

  let processed = 0
  for (const row of rows) {
    const t = byId.get(row.id)
    if (!t || !t.prompt_id?.trim() || !Array.isArray(t.choices_id) || t.choices_id.length !== 4) continue
    const translatedChoices = t.choices_id.map(String)
    const update: Record<string, unknown> = {
      prompt_id: t.prompt_id.trim(),
      choices_id: translatedChoices,
      prompt: t.prompt_id.trim(),
      choices: translatedChoices,
    }
    if (typeof t.explanation_id === 'string' && t.explanation_id.trim()) update.explanation_id = t.explanation_id.trim()
    const { error: updateError } = await supabaseAdmin.from('questions').update(update).eq('id', row.id)
    if (!updateError) processed += 1
  }

  const { count } = await supabaseAdmin
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
    .or('prompt_id.is.null,choices_id.is.null')

  return { requested: limit, processed, remaining: count ?? 0, model: MODEL }
}
