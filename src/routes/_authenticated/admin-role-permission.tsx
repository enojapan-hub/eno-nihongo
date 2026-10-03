import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Plus, Search, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
export const Route = createFileRoute("/_authenticated/admin-role-permission")({ component: Page });
type RolePermission = { key: string; scope: string };
type RoleRow = {
  id: string | null;
  name: string;
  description?: string | null;
  is_active?: boolean;
  system_role?: boolean | null;
  members?: number | null;
  permissions: RolePermission[];
};
type PermissionDef = { key: string; module: string; name: string; risk?: string | null };
type RoleConsole = {
  roles?: RoleRow[];
  permissions?: PermissionDef[];
  can_manage?: boolean;
};
// id null berarti membuat role baru; tipe generated menyebut p_id string saja.
type SaveRoleArgs = {
  p_id: string | null;
  p_name: string;
  p_description: string;
  p_permissions: Json;
  p_is_active: boolean;
};
function Page() {
  const qc = useQueryClient(),
    [search, setSearch] = useState(""),
    [edit, setEdit] = useState<RoleRow | null>(null),
    [msg, setMsg] = useState("");
  const q = useQuery({
    queryKey: ["role-permission-console"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_role_permission_console");
      if (error) throw error;
      return data as unknown as RoleConsole;
    },
    retry: false,
  });
  const roles = useMemo(
    () => (q.data?.roles || []).filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [q.data, search],
  );
  const perms = q.data?.permissions || [];
  const modules = [...new Set(perms.map((p) => p.module))];
  function start(r?: RoleRow) {
    setEdit(
      r
        ? { ...r, permissions: [...(r.permissions || [])] }
        : { id: null, name: "", description: "", is_active: true, permissions: [] },
    );
  }
  function has(k: string) {
    return edit?.permissions?.some((x) => x.key === k);
  }
  function toggle(k: string) {
    if (!edit) return;
    setEdit({
      ...edit,
      permissions: has(k)
        ? edit.permissions.filter((x) => x.key !== k)
        : [...edit.permissions, { key: k, scope: "all" }],
    });
  }
  async function save() {
    setMsg("");
    if (!edit) return;
    const { error } = await (
      supabase as unknown as {
        rpc(
          name: "admin_save_role",
          args: SaveRoleArgs,
        ): PromiseLike<{ error: { message: string } | null }>;
      }
    ).rpc("admin_save_role", {
      p_id: edit.id,
      p_name: edit.name,
      p_description: edit.description ?? "",
      p_permissions: edit.permissions,
      p_is_active: edit.is_active ?? true,
    });
    setMsg(error ? error.message : "Role berhasil disimpan.");
    if (!error) {
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["role-permission-console"] });
    }
  }
  if (q.isLoading)
    return (
      <AppShell title="Role & Permission" backTo="/admin">
        <p className="p-4 text-xs">Memuat permission…</p>
      </AppShell>
    );
  if (q.isError)
    return (
      <AppShell title="Role & Permission" backTo="/admin">
        <p className="p-4 text-xs text-destructive">Akses Admin diperlukan.</p>
      </AppShell>
    );
  return (
    <AppShell title="Role & Permission" backTo="/admin">
      <div className="mx-auto max-w-5xl space-y-4 pb-10">
        <section className="rounded-[2rem] bg-gradient-to-br from-primary to-emerald-800 p-5 text-primary-foreground">
          <ShieldCheck className="size-6" />
          <h1 className="mt-2 text-2xl font-black">Role & Permission</h1>
          <p className="text-xs text-white/75">
            Kontrol akses terpusat ENO NIHONGO · default deny.
          </p>
        </section>
        {msg && <p className="rounded-xl bg-muted p-3 text-xs">{msg}</p>}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari role…"
            />
          </div>
          {q.data?.can_manage && (
            <Button onClick={() => start()}>
              <Plus className="mr-1 size-4" />
              Role Baru
            </Button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.description || "Tanpa deskripsi"}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold">
                    {r.system_role ? "Sistem" : "Custom"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 text-[10px]">
                  <span className="rounded-lg bg-primary/10 px-2 py-1 text-primary">
                    <Users className="mr-1 inline size-3" />
                    {r.members} anggota
                  </span>
                  <span className="rounded-lg bg-muted px-2 py-1">{r.permissions.length} izin</span>
                  <span className="rounded-lg bg-muted px-2 py-1">
                    {r.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                {q.data?.can_manage && !r.system_role && (
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => start(r)}>
                    Kelola Izin
                  </Button>
                )}
                {q.data?.can_manage && (
                  <Button
                    className="ml-2 mt-3"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      start({ ...r, id: null, name: r.name + " Salinan", system_role: false })
                    }
                  >
                    <Copy className="mr-1 size-3" />
                    Duplikasi
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {edit && (
          <Card className="border-primary/30">
            <CardContent className="space-y-4 p-4">
              <div>
                <p className="font-black">{edit.id ? "Kelola Role" : "Buat Role"}</p>
                <p className="text-[10px] text-muted-foreground">
                  Perubahan permission berlaku setelah disimpan dan dicatat ke Audit Log.
                </p>
              </div>
              <Input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                placeholder="Nama role"
              />
              <Input
                value={edit.description || ""}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                placeholder="Deskripsi"
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={edit.is_active}
                  onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })}
                />
                Role aktif
              </label>
              {modules.map((m) => (
                <div key={m}>
                  <p className="mb-2 text-xs font-black">{m}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {perms
                      .filter((p) => p.module === m)
                      .map((p) => (
                        <label key={p.key} className="flex gap-2 rounded-xl border p-3 text-xs">
                          <input
                            type="checkbox"
                            checked={has(p.key)}
                            onChange={() => toggle(p.key)}
                          />
                          <span>
                            <b>{p.name}</b>
                            <span className="ml-2 text-[9px] uppercase text-muted-foreground">
                              {p.risk}
                            </span>
                            <p className="text-[9px] text-muted-foreground">{p.key}</p>
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button onClick={save} disabled={!edit.name.trim()}>
                  Simpan Role
                </Button>
                <Button variant="outline" onClick={() => setEdit(null)}>
                  Batal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
