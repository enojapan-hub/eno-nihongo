import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  Crown,
  LockKeyhole,
  Pencil,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/admin-langganan")({ component: Page });
type SubscriptionPlan = {
  id: string;
  name: string;
  lifetime?: boolean | null;
  duration_days?: number | null;
  price?: number | string | null;
  is_active?: boolean | null;
};
type AdminOverview = { premium_users?: number; lifetime_users?: number; free_users?: number };
const rupiah = (n: unknown) => "Rp" + Number(n || 0).toLocaleString("id-ID");
function Page() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<SubscriptionPlan | null>(null);
  const [price, setPrice] = useState("");
  const plans = useQuery({
    queryKey: ["plans-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_subscription_plans");
      if (error) throw error;
      return (data || []) as unknown as SubscriptionPlan[];
    },
    retry: false,
  });
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_overview");
      if (error) throw error;
      return data || {};
    },
  });
  async function savePrice() {
    const n = Number(price);
    if (!edit || !Number.isFinite(n) || n < 0) return alert("Harga tidak valid");
    // p_is_active dihilangkan: default fungsi database adalah NULL (tidak mengubah status).
    const { error } = await supabase.rpc("admin_update_subscription_plan", {
      p_plan_id: edit.id,
      p_price: n,
    });
    if (error) return alert(error.message);
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["plans-admin"] });
  }
  async function toggle(x: SubscriptionPlan) {
    // p_price dihilangkan: default fungsi database adalah NULL (tidak mengubah harga).
    const { error } = await supabase.rpc("admin_update_subscription_plan", {
      p_plan_id: x.id,
      p_is_active: !x.is_active,
    });
    if (error) return alert(error.message);
    qc.invalidateQueries({ queryKey: ["plans-admin"] });
  }
  const o = (overview.data || {}) as AdminOverview;
  const metrics = [
    ["Premium Aktif", o.premium_users || 0, Crown],
    ["Lifetime", o.lifetime_users || 0, BadgeCheck],
    ["Free", o.free_users || 0, Users],
    ["Pembayaran", 0, ReceiptText],
  ] as const;
  return (
    <AppShell title="Langganan" backTo="/admin">
      <div className="mx-auto max-w-5xl space-y-5 pb-10">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-emerald-800 p-5 text-primary-foreground shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
                <Sparkles className="size-3" />
                Subscription Center
              </p>
              <h1 className="mt-2 text-2xl font-black">Langganan ENO</h1>
              <p className="mt-1 text-xs text-white/75">
                Kelola paket dan akses pelanggan dari satu tempat.
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
              <ShoppingBag className="size-6" />
            </span>
          </div>
        </section>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map(([label, value, Icon]) => (
            <Card key={label}>
              <CardContent className="p-3">
                <Icon className="size-4 text-primary" />
                <p className="mt-2 text-xl font-black">{Number(value).toLocaleString("id-ID")}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-amber-500/20 bg-amber-500/[.05]">
          <CardContent className="flex gap-3 p-4">
            <LockKeyhole className="size-5 shrink-0 text-amber-600" />
            <div className="text-xs">
              <b>Checkout belum diaktifkan</b>
              <p className="mt-1 text-muted-foreground">
                Desain dan paket dapat disiapkan. Transaksi Duitku tetap terkunci sampai integrasi
                disetujui.
              </p>
            </div>
          </CardContent>
        </Card>
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-black">
            <Crown className="size-4 text-primary" />
            Paket Langganan
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {plans.isError ? (
              <p className="text-xs text-destructive">Khusus Admin/Owner.</p>
            ) : (
              (plans.data || []).map((x) => (
                <Card key={x.id}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="flex gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                        {x.lifetime ? (
                          <Crown className="size-5" />
                        ) : (
                          <CalendarClock className="size-5" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-black">{x.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {x.lifetime
                            ? "Lifetime"
                            : x.duration_days
                              ? x.duration_days + " hari"
                              : "Dasar"}{" "}
                          · {rupiah(x.price)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEdit(x);
                          setPrice(String(x.price || 0));
                        }}
                      >
                        <Pencil className="mr-1 size-3" />
                        Harga
                      </Button>
                      <Button
                        size="sm"
                        variant={x.is_active ? "default" : "outline"}
                        onClick={() => toggle(x)}
                      >
                        {x.is_active ? "Aktif" : "Nonaktif"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
        <section className="grid gap-2 sm:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-black">
                <ReceiptText className="size-4 text-primary" />
                Transaksi Langganan
              </h3>
              <p className="mt-3 text-xs text-muted-foreground">
                Belum ada transaksi pembayaran yang dapat ditampilkan.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="flex items-center gap-2 text-sm font-black">
                <CircleDollarSign className="size-4 text-primary" />
                Sumber Akses
              </h3>
              <p className="mt-3 text-xs text-muted-foreground">
                Premium pembayaran dan Premium manual Admin akan dibedakan setelah integrasi
                pembayaran aktif.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
