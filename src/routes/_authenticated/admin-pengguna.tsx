import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Search, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin-pengguna")({ component: Page });

function premiumDays(value: string | null) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));
}

function Page() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [premiumId, setPremiumId] = useState<string | null>(null);
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_admin_console_data", { p_section: "users", p_level: null });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });

  async function role(id: string, value: string) {
    setMsg("");
    const { error } = await (supabase as any).rpc("admin_set_user_role", { p_user_id: id, p_role: value });
    setMsg(error ? error.message : "Role pengguna diperbarui.");
    if (!error) qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function givePremium(id: string) {
    const duration = Number(days);
    if (!Number.isInteger(duration) || duration < 1 || duration > 3650) {
      setMsg("Durasi Premium harus 1–3650 hari.");
      return;
    }
    setBusy(id);
    setMsg("");
    const { error } = await (supabase as any).rpc("admin_set_user_premium", { p_user_id: id, p_duration_days: duration });
    setBusy(null);
    setMsg(error ? error.message : `Premium diberikan selama ${duration} hari.`);
    if (!error) {
      setPremiumId(null);
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    }
  }

  async function makeFree(id: string) {
    if (!confirm("Ubah akun ini menjadi Free dan akhiri Premium?")) return;
    setBusy(id);
    setMsg("");
    const { error } = await (supabase as any).rpc("admin_set_user_free", { p_user_id: id });
    setBusy(null);
    setMsg(error ? error.message : "Akun diubah menjadi Free.");
    if (!error) await qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  const rows = (q.data ?? []).filter(
    (x: any) =>
      (x.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
      String(x.id).includes(search),
  );

  return (
    <AppShell title="Pengguna" backTo="/admin">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black"><Users className="size-5" />Pengguna & Akses</h1>
          <p className="text-xs text-muted-foreground">Kelola role dan akses Premium pengguna.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama pengguna…" />
        </div>

        {msg && <p className="rounded-xl bg-muted p-3 text-xs" role="status">{msg}</p>}
        {q.isError && <p className="text-xs text-destructive">Akses Admin diperlukan.</p>}

        <Card>
          <CardContent className="divide-y p-3">
            {rows.map((u: any) => {
              const remaining = u.plan === "premium" ? premiumDays(u.premium_until) : null;
              const activePremium = u.plan === "premium" && remaining !== null && remaining > 0;
              return (
                <div key={u.id} className="space-y-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{u.display_name || "Tanpa nama"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="rounded-full bg-muted px-2 py-1">{u.target_level || "-"}</span>
                        {u.plan === "lifetime" ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary"><Crown className="mr-1 inline size-3" />Lifetime</span>
                        ) : activePremium ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">Premium · sisa {remaining} hari</span>
                        ) : u.plan === "premium" ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-1 font-bold text-destructive">Premium berakhir</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-1">Free</span>
                        )}
                      </div>
                      {u.plan === "premium" && u.premium_until && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Aktif sampai {new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(new Date(u.premium_until))}
                        </p>
                      )}
                    </div>
                    {u.role === "owner" ? (
                      <span className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary"><ShieldCheck className="size-3" />Owner</span>
                    ) : (
                      <select value={u.role || "student"} onChange={(e) => role(u.id, e.target.value)} className="rounded-lg border bg-background px-2 py-2 text-xs">
                        <option value="student">Student</option>
                        <option value="teacher">Guru</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setPremiumId(premiumId === u.id ? null : u.id); setDays("30"); }}>
                      {activePremium ? "Atur Premium" : "Berikan Premium"}
                    </Button>
                    {(u.plan === "premium" || u.plan === "lifetime") && u.role !== "owner" && (
                      <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => makeFree(u.id)}>Jadikan Free</Button>
                    )}
                  </div>

                  {premiumId === u.id && (
                    <div className="flex items-end gap-2 rounded-xl bg-muted/50 p-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-bold">Durasi Premium (hari)</label>
                        <Input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />
                      </div>
                      <Button disabled={busy === u.id} onClick={() => givePremium(u.id)}>{busy === u.id ? "Menyimpan…" : "Aktifkan"}</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="p-4 text-xs text-muted-foreground">
            <b>Tambah pengguna:</b> ENO NIHONGO menggunakan Google Sign-In. Akun dibuat saat pengguna masuk pertama kali agar identitas Google tetap tervalidasi. Setelah akun muncul di sini, Admin dapat mengatur role dan Premium.
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
