import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Crown, Filter, MailPlus, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin-pengguna")({
  validateSearch: (s: Record<string, unknown>) => ({ view: String(s["view"] || "users") }),
  component: Page,
});
const PAGE = 20;
const fmt = (v?: string | null) =>
  v
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Tokyo" }).format(
        new Date(v),
      )
    : "—";
const daysLeft = (v?: string | null) =>
  v ? Math.max(0, Math.ceil((new Date(v).getTime() - Date.now()) / 86400000)) : null;

function Page() {
  const qc = useQueryClient();
  const routeSearch = Route.useSearch();
  const [search, setSearch] = useState(""),
    [plan, setPlan] = useState("all"),
    [roleFilter, setRoleFilter] = useState("all"),
    [level, setLevel] = useState("all"),
    [status, setStatus] = useState("all");
  const [page, setPage] = useState(1),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [detail, setDetail] = useState<any | null>(null);
  const [premiumId, setPremiumId] = useState<string | null>(null),
    [days, setDays] = useState("30"),
    [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "student", plan: "free", days: "30" });

  const q = useQuery({
    queryKey: ["admin-users-v2"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_admin_users");
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
  const audit = useQuery({
    queryKey: ["admin-user-audit", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_admin_user_audit", {
        p_user_id: detail.id,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () =>
      ((q.data ?? []) as any[]).filter((u) => {
        const term = search.toLowerCase();
        if (
          term &&
          !String(u.display_name ?? "")
            .toLowerCase()
            .includes(term) &&
          !String(u.email ?? "")
            .toLowerCase()
            .includes(term)
        )
          return false;
        if (plan !== "all" && u.plan !== plan) return false;
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (level !== "all" && u.target_level !== level) return false;
        if (status === "suspended" && !u.suspended_at) return false;
        if (status === "active" && u.suspended_at) return false;
        return true;
      }),
    [q.data, search, plan, roleFilter, level, status],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-users-v2"] });
  };

  async function setRole(id: string, value: string) {
    setMsg("");
    const { error } = await (supabase as any).rpc("admin_set_user_role", {
      p_user_id: id,
      p_role: value,
    });
    setMsg(error ? error.message : "Role diperbarui.");
    if (!error) refresh();
  }
  async function premium(id: string) {
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 3650) {
      setMsg("Durasi harus 1–3650 hari.");
      return;
    }
    setBusy(id);
    const { error } = await (supabase as any).rpc("admin_set_user_premium", {
      p_user_id: id,
      p_duration_days: d,
    });
    setBusy(null);
    setMsg(error ? error.message : `Premium aktif ${d} hari.`);
    if (!error) {
      setPremiumId(null);
      refresh();
    }
  }
  async function free(id: string) {
    if (!confirm("Akhiri Premium dan ubah akun menjadi Free?")) return;
    setBusy(id);
    const { error } = await (supabase as any).rpc("admin_set_user_free", { p_user_id: id });
    setBusy(null);
    setMsg(error ? error.message : "Akun menjadi Free.");
    if (!error) refresh();
  }
  async function suspend(u: any) {
    const next = !u.suspended_at;
    const note = next ? prompt("Catatan/alasan suspend (opsional):", "") : "";
    if (next && note === null) return;
    if (
      !confirm(
        next
          ? "Suspend akun ini? Pengguna akan dikeluarkan saat membuka halaman berikutnya."
          : "Aktifkan kembali akun ini?",
      )
    )
      return;
    setBusy(u.id);
    const { error } = await (supabase as any).rpc("admin_set_user_suspended", {
      p_user_id: u.id,
      p_suspended: next,
      p_note: note || null,
    });
    setBusy(null);
    setMsg(error ? error.message : next ? "Akun disuspend." : "Akun diaktifkan kembali.");
    if (!error) refresh();
  }
  async function sendInvite() {
    const d = Number(invite.days);
    setBusy("invite");
    const { error } = await (supabase as any).rpc("admin_invite_user", {
      p_email: invite.email,
      p_role: invite.role,
      p_plan: invite.plan,
      p_duration_days: invite.plan === "premium" ? d : null,
    });
    setBusy(null);
    setMsg(
      error
        ? error.message
        : "Undangan disimpan. Akses otomatis aktif saat email tersebut login dengan Google.",
    );
    if (!error) {
      setShowInvite(false);
      setInvite({ email: "", role: "student", plan: "free", days: "30" });
    }
  }

  return (
    <AppShell title="Pengguna" backTo="/admin">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black">
              {routeSearch.view === "roles" ? (
                <ShieldCheck className="size-5" />
              ) : (
                <Users className="size-5" />
              )}
              {routeSearch.view === "roles" ? "Role & Permission" : "Pengguna & Akses"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {routeSearch.view === "roles"
                ? "Kelola role dan hak akses akun terdaftar"
                : `${q.data?.length ?? 0} akun terdaftar`}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowInvite(!showInvite)}>
            <MailPlus className="mr-1 size-4" />
            Tambah
          </Button>
        </div>
        {showInvite && (
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold">Email Google</label>
                <Input
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                  placeholder="nama@gmail.com"
                />
              </div>
              <select
                className="rounded-lg border bg-background p-2 text-sm"
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value })}
              >
                <option value="student">Student</option>
                <option value="teacher">Guru</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <select
                className="rounded-lg border bg-background p-2 text-sm"
                value={invite.plan}
                onChange={(e) => setInvite({ ...invite, plan: e.target.value })}
              >
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
              {invite.plan === "premium" && (
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={invite.days}
                  onChange={(e) => setInvite({ ...invite, days: e.target.value })}
                  placeholder="Durasi hari"
                />
              )}
              <Button disabled={busy === "invite" || !invite.email} onClick={sendInvite}>
                {busy === "invite" ? "Menyimpan…" : "Simpan Undangan"}
              </Button>
              <p className="sm:col-span-2 text-[10px] text-muted-foreground">
                Akun tetap dibuat melalui Google Sign-In. Role/Premium diterapkan otomatis saat
                email yang sama login pertama kali.
              </p>
            </CardContent>
          </Card>
        )}
        {msg && <p className="rounded-xl bg-muted p-3 text-xs">{msg}</p>}
        <Card>
          <CardContent className="space-y-3 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama atau email…"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select
                className="rounded-lg border bg-background p-2 text-xs"
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua paket</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="lifetime">Lifetime</option>
              </select>
              <select
                className="rounded-lg border bg-background p-2 text-xs"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua role</option>
                <option value="student">Student</option>
                <option value="teacher">Guru</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
              <select
                className="rounded-lg border bg-background p-2 text-xs"
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua level</option>
                {["N5", "N4", "N3", "N2", "N1"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <select
                className="rounded-lg border bg-background p-2 text-xs"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua status</option>
                <option value="active">Aktif</option>
                <option value="suspended">Suspend</option>
              </select>
            </div>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Filter className="size-3" />
              {filtered.length} hasil
            </p>
          </CardContent>
        </Card>
        {q.isError && <p className="text-xs text-destructive">Akses Admin diperlukan.</p>}
        <Card>
          <CardContent className="divide-y p-3">
            {rows.map((u: any) => {
              const left = u.plan === "premium" ? daysLeft(u.premium_until) : null;
              return (
                <div key={u.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex gap-3">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(u)}>
                      <p className="truncate text-sm font-black">
                        {u.display_name || "Tanpa nama"}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">{u.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                        <span className="rounded-full bg-muted px-2 py-1">
                          {u.target_level || "—"}
                        </span>
                        {u.suspended_at ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-1 font-bold text-destructive">
                            Suspend
                          </span>
                        ) : null}
                        {u.plan === "lifetime" ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">
                            <Crown className="mr-1 inline size-3" />
                            Lifetime
                          </span>
                        ) : u.plan === "premium" ? (
                          <span className="rounded-full bg-primary/10 px-2 py-1 font-bold text-primary">
                            Premium · {left} hari
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-1">Free</span>
                        )}
                      </div>
                    </button>
                    {u.role === "owner" ? (
                      <span className="flex h-fit items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                        <ShieldCheck className="size-3" />
                        Owner
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => setRole(u.id, e.target.value)}
                        className="h-fit rounded-lg border bg-background p-2 text-xs"
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Guru</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </div>
                  {u.plan === "premium" && u.premium_until && (
                    <p className="text-[10px] text-muted-foreground">
                      Premium sampai {fmt(u.premium_until)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPremiumId(premiumId === u.id ? null : u.id);
                        setDays("30");
                      }}
                    >
                      {u.plan === "premium" ? "Atur Premium" : "Berikan Premium"}
                    </Button>
                    {(u.plan === "premium" || u.plan === "lifetime") && u.role !== "owner" && (
                      <Button size="sm" variant="ghost" onClick={() => free(u.id)}>
                        Jadikan Free
                      </Button>
                    )}
                    {u.role !== "owner" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === u.id}
                        onClick={() => suspend(u)}
                      >
                        <Ban className="mr-1 size-3" />
                        {u.suspended_at ? "Aktifkan" : "Suspend"}
                      </Button>
                    )}
                  </div>
                  {premiumId === u.id && (
                    <div className="flex items-end gap-2 rounded-xl bg-muted/50 p-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold">Durasi Premium (hari)</label>
                        <Input
                          type="number"
                          min={1}
                          max={3650}
                          value={days}
                          onChange={(e) => setDays(e.target.value)}
                        />
                      </div>
                      <Button disabled={busy === u.id} onClick={() => premium(u.id)}>
                        Aktifkan
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Sebelumnya
          </Button>
          <span className="text-xs">
            Halaman {page}/{pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
        {detail && (
          <Card className="border-primary/20">
            <CardContent className="space-y-3 p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 font-black">
                    <UserRound className="size-4" />
                    Detail Pengguna
                  </h2>
                  <p className="text-xs">
                    {detail.display_name || "Tanpa nama"} · {detail.email}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>
                  Tutup
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <b>Terdaftar</b>
                  <p>{fmt(detail.created_at)}</p>
                </div>
                <div>
                  <b>Login terakhir</b>
                  <p>{fmt(detail.last_sign_in_at)}</p>
                </div>
                <div>
                  <b>Aktivitas belajar</b>
                  <p>{fmt(detail.last_learning_at)}</p>
                </div>
                <div>
                  <b>Paket</b>
                  <p>
                    {detail.plan}
                    {detail.plan === "premium" ? ` · ${daysLeft(detail.premium_until)} hari` : ""}
                  </p>
                </div>
              </div>
              {detail.admin_note && (
                <p className="rounded-lg bg-muted p-2 text-xs">
                  <b>Catatan Admin:</b> {detail.admin_note}
                </p>
              )}
              <div>
                <h3 className="mb-1 text-xs font-bold">Riwayat tindakan Admin</h3>
                {audit.isLoading ? (
                  <p className="text-xs text-muted-foreground">Memuat…</p>
                ) : (audit.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Belum ada riwayat.</p>
                ) : (
                  <div className="space-y-1">
                    {(audit.data ?? []).map((a: any, i: number) => (
                      <p key={i} className="text-[10px]">
                        <b>{a.action}</b> · {fmt(a.created_at)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
