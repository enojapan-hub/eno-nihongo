import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileCheck2, FileUp, History, Languages, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/admin-import-export")({ component: Page });
const types: any = {
  kanji: "Kanji",
  vocabulary: "Kosakata",
  grammar: "Bunpou",
  reading: "Dokkai",
  listening: "Chōkai",
  questions: "Soal Simulasi",
};
async function hdr() {
  const { data } = await supabase.auth.getSession();
  return {
    Authorization: "Bearer " + data.session?.access_token,
    "Content-Type": "application/json",
  };
}
function csv(text: string) {
  const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter(Boolean),
    head = (lines.shift() || "").split(",").map((x) => x.trim());
  return lines.map((line) => {
    const vals: string[] = [];
    let v = "",
      q = false;
    for (let i = 0; i <= line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        v += '"';
        i++;
      } else if (ch === '"') q = !q;
      else if ((ch === "," || i === line.length) && !q) {
        vals.push(v);
        v = "";
      } else v += ch || "";
    }
    return Object.fromEntries(head.map((h, i) => [h, vals[i] ?? ""]));
  });
}
function esc(v: any) {
  const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function Page() {
  const [type, setType] = useState("vocabulary"),
    [level, setLevel] = useState("all"),
    [mode, setMode] = useState("insert"),
    [rows, setRows] = useState<any[]>([]),
    [file, setFile] = useState(""),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const jobs = useQuery({
    queryKey: ["import-jobs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_admin_import_jobs");
      if (error) throw error;
      return data || [];
    },
  });
  async function pick(e: any) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) return alert("Saat ini gunakan template CSV.");
    setFile(f.name);
    setRows(csv(await f.text()));
    setResult(null);
  }
  async function run(dryRun: boolean) {
    if (!rows.length) return;
    setBusy(true);
    const r = await fetch("/api/admin-import-export", {
        method: "POST",
        headers: await hdr(),
        body: JSON.stringify({ type, mode, rows, dryRun, fileName: file }),
      }),
      d = await r.json();
    setResult(d);
    setBusy(false);
    if (!dryRun && !d.error) jobs.refetch();
  }
  async function exportData(template = false) {
    setBusy(true);
    const r = await fetch(
        "/api/admin-import-export?type=" + type + "&level=" + (template ? "none" : level),
        { headers: await hdr() },
      ),
      d = await r.json();
    setBusy(false);
    if (d.error) return alert(d.error);
    const fields = d.fields || [],
      out = [
        fields.join(","),
        ...(template
          ? []
          : (d.rows || []).map((x: any) => fields.map((k: string) => esc(x[k])).join(","))),
      ].join("\n"),
      a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + out], { type: "text/csv;charset=utf-8" }));
    a.download = template ? `template-${type}.csv` : `eno-${type}-${level}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <AppShell title="Import / Export" backTo="/admin">
      <div className="mx-auto max-w-5xl space-y-4 pb-10">
        <section className="rounded-[2rem] bg-gradient-to-br from-primary to-emerald-800 p-5 text-primary-foreground shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-widest">Data Manager</p>
          <h1 className="mt-2 text-2xl font-black">Import / Export</h1>
          <p className="mt-1 text-xs text-white/75">
            Validasi sebelum write. Maksimal 5.000 baris per proses.
          </p>
        </section>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(types).map(([id, l]: any) => (
            <button
              key={id}
              onClick={() => {
                setType(id);
                setRows([]);
                setResult(null);
              }}
              className={`rounded-2xl border p-3 text-left text-xs font-bold ${type === id ? "border-primary bg-primary/10 text-primary" : "bg-card"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <FileUp className="size-5 text-primary" />
              <div>
                <p className="font-black">Import {types[type]}</p>
                <p className="text-[10px] text-muted-foreground">
                  CSV resmi → preview → dry-run → konfirmasi import.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => exportData(true)}>
                <Download className="mr-1 size-4" />
                Template CSV
              </Button>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground">
                Pilih CSV
                <input className="hidden" type="file" accept=".csv,text/csv" onChange={pick} />
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === "insert" ? "default" : "outline"}
                onClick={() => {
                  setMode("insert");
                  setResult(null);
                }}
              >
                Tambah baru
              </Button>
              <Button
                size="sm"
                variant={mode === "update" ? "default" : "outline"}
                onClick={() => {
                  setMode("update");
                  setResult(null);
                }}
              >
                Update
              </Button>
            </div>
            {rows.length > 0 && (
              <div className="rounded-2xl bg-muted/60 p-3 text-xs">
                <b>{file}</b>
                <p>{rows.length} baris siap divalidasi.</p>
                <div className="mt-2 flex gap-2">
                  <Button disabled={busy} size="sm" variant="outline" onClick={() => run(true)}>
                    <FileCheck2 className="mr-1 size-4" />
                    Dry-run
                  </Button>
                  <Button
                    disabled={busy || !result?.dryRun || result.failed > 0}
                    size="sm"
                    onClick={() => confirm("Import data yang sudah lolos validasi?") && run(false)}
                  >
                    Import
                  </Button>
                </div>
              </div>
            )}
            {result && (
              <div
                className={`rounded-2xl p-3 text-xs ${result.error || result.failed ? "bg-destructive/10" : "bg-primary/10"}`}
              >
                <b>
                  {result.error ? "Gagal" : result.dryRun ? "Hasil validasi" : "Import selesai"}
                </b>
                <p>
                  Total {result.total || 0} · Valid/Berhasil {result.valid ?? result.success ?? 0} ·
                  Gagal {result.failed || 0}
                </p>
                {(result.errors || []).slice(0, 5).map((e: any, i: number) => (
                  <p key={i} className="mt-1 text-destructive">
                    Baris {e.row}: {e.error}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Download className="size-5 text-primary" />
              <p className="font-black">Export {types[type]}</p>
            </div>
            <select
              className="w-full rounded-xl border bg-background p-2 text-sm"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="all">Semua level</option>
              {["N5", "N4", "N3", "N2", "N1"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <Button
              className="w-full"
              variant="outline"
              disabled={busy}
              onClick={() => exportData(false)}
            >
              Download CSV
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <History className="size-4 text-primary" />
              <p className="font-black">Riwayat Import</p>
            </div>
            {(jobs.data || []).slice(0, 8).map((j: any) => (
              <div key={j.id} className="border-t py-2 text-[10px] first:border-0">
                <b>
                  {types[j.content_type]} · {j.mode === "insert" ? "Tambah" : "Update"}
                </b>
                <p className="text-muted-foreground">
                  {j.file_name || "CSV"} · {j.success_rows} berhasil · {j.failed_rows} gagal
                </p>
              </div>
            ))}
            {!jobs.data?.length && (
              <p className="text-xs text-muted-foreground">Belum ada riwayat.</p>
            )}
          </CardContent>
        </Card>
        <Link
          to="/admin-terjemahan"
          className="flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold text-primary"
        >
          <Languages className="size-4" />
          Batch Terjemahan tetap terpisah
        </Link>
        <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <ShieldCheck className="size-3" />
          Import tidak menulis sebelum dry-run lolos.
        </p>
      </div>
    </AppShell>
  );
}
