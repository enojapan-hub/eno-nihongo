import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { socialApi } from "@/lib/social/social-api";
import type { AdminChatReport } from "@/lib/social/social-types";
import { REPORT_CATEGORIES, socialErrorMessage } from "@/lib/social/social-validation";

const STATUSES: ReadonlyArray<readonly [AdminChatReport["status"], string]> = [
  ["open", "Baru"],
  ["reviewing", "Diproses"],
  ["resolved", "Selesai"],
  ["rejected", "Ditolak"],
];

/**
 * Antrean moderasi Social/Chat. Semua izin ditegakkan server (social_admin_*); setiap tindakan masuk
 * audit log. Bukti hanya potongan pesan yang dilaporkan (Admin tidak membaca DM privat secara bebas).
 */
export function AdminSocialReports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AdminChatReport["status"]>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["social", "admin-reports", status],
    queryFn: () => socialApi.adminReports(status),
    retry: false,
  });

  async function act(r: AdminChatReport, action: "reviewing" | "resolve" | "reject" | "suspend") {
    const note =
      action === "resolve" || action === "suspend"
        ? (window.prompt("Catatan (opsional):") ?? null)
        : null;
    setBusy(r.id);
    try {
      await socialApi.adminResolveReport(r.id, action, note);
      toast.success("Tindakan tersimpan.");
      await qc.invalidateQueries({ queryKey: ["social", "admin-reports"] });
    } catch (e) {
      toast.error(socialErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function unsuspend(r: AdminChatReport) {
    if (!r.target_id) return;
    setBusy(r.id);
    try {
      await socialApi.adminSocialSuspend(r.target_id, false, null);
      toast.success("Batasan sosial dicabut.");
      await qc.invalidateQueries({ queryKey: ["social", "admin-reports"] });
    } catch (e) {
      toast.error(socialErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (q.isError)
    return (
      <p className="rounded-md border p-3 text-xs text-muted-foreground" role="status">
        Antrean moderasi Chat hanya untuk Owner/Admin.
      </p>
    );
  const label = (c: string) => REPORT_CATEGORIES.find(([k]) => k === c)?.[1] ?? c;
  return (
    <section aria-label="Moderasi Chat" className="space-y-2" data-testid="social-reports">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold">Laporan Chat</h3>
        <select
          aria-label="Status laporan chat"
          className="rounded-md border bg-background px-2 py-1 text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value as AdminChatReport["status"])}
        >
          {STATUSES.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {q.isLoading && <p className="text-xs text-muted-foreground">Memuat…</p>}
      {q.data?.length === 0 && (
        <p className="text-xs text-muted-foreground">Tidak ada laporan pada status ini.</p>
      )}
      {(q.data ?? []).map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-1 p-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5 font-bold">
                {label(r.category)}
              </span>
              <span>Pelapor: @{r.reporter ?? "?"}</span>
              <span>Terlapor: @{r.target ?? "?"}</span>
              <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleString("id-ID")}</time>
              {r.target_social_suspended && (
                <span className="font-bold text-destructive">Sosial dibatasi</span>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{r.evidence}</p>
            {r.resolution_note && (
              <p className="text-[11px] text-muted-foreground">Catatan: {r.resolution_note}</p>
            )}
            {r.target_social_suspended && r.target_id && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy === r.id}
                onClick={() => void unsuspend(r)}
              >
                Cabut batasan sosial
              </Button>
            )}
            {(r.status === "open" || r.status === "reviewing") && (
              <div className="flex flex-wrap gap-2 pt-1">
                {r.status === "open" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    onClick={() => void act(r, "reviewing")}
                  >
                    Tangani
                  </Button>
                )}
                <Button size="sm" disabled={busy === r.id} onClick={() => void act(r, "resolve")}>
                  Selesaikan
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => void act(r, "reject")}
                >
                  Tolak
                </Button>
                {r.target_id && !r.target_social_suspended && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy === r.id}
                    onClick={() => void act(r, "suspend")}
                  >
                    Batasi sosial
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
