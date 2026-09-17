import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PUBLIC_PLANS, formatRupiah } from "@/lib/public-plans";

export const Route = createFileRoute("/_authenticated/checkout")({ component: CheckoutPage });

function CheckoutPage() {
  const planCode = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("plan");
  const plan = PUBLIC_PLANS.find((item) => item.code === planCode) ?? PUBLIC_PLANS[0];
  return <AppShell title="Checkout Paket" backTo="/paket" backLabel="Paket Premium" compact><div className="mx-auto max-w-md space-y-3">
    <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5"><p className="text-[10px] font-black tracking-wide text-primary">RINGKASAN PESANAN</p><h1 className="mt-2 text-xl font-black">{plan.name}</h1><p className="mt-1 text-xs text-muted-foreground">{plan.description}</p><div className="mt-5 flex items-end justify-between border-t pt-4"><span className="text-sm font-semibold">Total pembayaran</span><span className="text-xl font-black text-primary">{formatRupiah(plan.price)}</span></div><p className="mt-1 text-right text-[10px] text-muted-foreground">{plan.billing}</p></section>
    <Card><CardContent className="space-y-3 p-4"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CreditCard className="size-4" /></span><div><p className="text-[12px] font-bold">Pembayaran aman melalui Duitku</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Setelah pembayaran berhasil, status paket akan masuk ke akun ini secara otomatis.</p></div></div><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span><p className="pt-1 text-[10px] leading-4 text-muted-foreground">Akses Premium baru aktif setelah konfirmasi pembayaran diterima.</p></div></CardContent></Card>
    <Button disabled className="h-11 w-full rounded-xl text-sm"><CheckCircle2 className="mr-2 size-4" />Pembayaran Sandbox sedang disiapkan</Button>
    <p className="px-4 text-center text-[10px] leading-4 text-muted-foreground">Kamu sudah berada di checkout. Tombol pembayaran akan aktif setelah akses Sandbox Duitku tersedia.</p>
  </div></AppShell>;
}
