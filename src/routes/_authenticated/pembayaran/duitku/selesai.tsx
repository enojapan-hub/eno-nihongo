import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, Home } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/pembayaran/duitku/selesai")({ component: PaymentReturnPage });

function PaymentReturnPage() {
  return <AppShell title="Status Pembayaran" backTo="/paket" compact><div className="mx-auto max-w-md space-y-3 pt-4">
    <Card className="rounded-3xl border-primary/20 bg-primary/[0.04]"><CardContent className="p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><CheckCircle2 className="size-6" /></span>
      <h1 className="mt-4 text-lg font-black">Pembayaran sedang dikonfirmasi</h1>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Duitku akan mengirim konfirmasi langsung ke sistem ENO NIHONGO. Setelah valid, akses paketmu aktif otomatis.</p>
    </CardContent></Card>
    <Card><CardContent className="flex gap-3 p-4 text-xs text-muted-foreground"><Clock3 className="mt-0.5 size-4 shrink-0 text-primary" /><p>Jika baru selesai membayar, tunggu sebentar lalu buka Dashboard. Jangan membayar ulang selama statusnya masih diproses.</p></CardContent></Card>
    <Button asChild className="h-11 w-full rounded-xl"><Link to="/dashboard"><Home className="mr-2 size-4" />Ke Dashboard</Link></Button>
  </div></AppShell>;
}
