import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/admin-terjemahan')({
  component: TranslationAdminPage,
})

type Stats = { total: number; pending: number; processing: number; completed: number; failed: number }
type BatchResult = { status?: string }
type BatchResponse = { stats?: Stats; results?: BatchResult[]; error?: string }

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sesi login tidak ditemukan.')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

function TranslationAdminPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0 })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const headers = await authHeaders()
    const response = await fetch('/api/admin-translation', { headers })
    const data = (await response.json()) as Stats & { error?: string }
    if (!response.ok) throw new Error(data.error ?? 'Gagal memuat statistik.')
    setStats(data)
  }, [])

  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : String(error))) }, [load])

  async function runBatch() {
    setBusy(true)
    setMessage('Menerjemahkan batch...')
    try {
      const headers = await authHeaders()
      const response = await fetch('/api/admin-translation', {
        method: 'POST', headers, body: JSON.stringify({ limit: 5 }),
      })
      const data = (await response.json()) as BatchResponse
      if (!response.ok) throw new Error(data.error ?? 'Batch gagal dijalankan.')
      if (!data.stats || !Array.isArray(data.results)) throw new Error('Respons batch terjemahan tidak valid.')
      setStats(data.stats)
      const completed = data.results.filter((result) => result.status === 'completed').length
      const failed = data.results.filter((result) => result.status === 'failed').length
      setMessage(`Batch selesai: ${completed} berhasil, ${failed} gagal.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const cards = [
    ['Eligible/tercatat', stats.total],
    ['Pending', stats.pending],
    ['Processing', stats.processing],
    ['Selesai', stats.completed],
    ['Gagal', stats.failed],
  ] as const

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">ENO JAPAN · ADMIN</p>
        <h1 className="mt-1 text-3xl font-bold">Terjemahan AI</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Terjemahkan materi berbahasa Inggris ke Bahasa Indonesia natural dan simpan hasilnya ke database. API key hanya berjalan di server.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Batch otomatis</h2>
            <p className="text-sm text-muted-foreground">5 materi per batch. Ulangi sampai Pending menjadi 0.</p>
          </div>
          <button disabled={busy} onClick={runBatch} className="rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-50">
            {busy ? 'Memproses…' : 'Mulai / lanjutkan'}
          </button>
        </div>
        {message && <p className="mt-4 rounded-xl bg-muted p-3 text-sm">{message}</p>}
      </section>
    </main>
  )
}