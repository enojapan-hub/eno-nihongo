import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES } from "@/lib/countries";

export const Route = createFileRoute("/_authenticated/onboarding")({ component: OnboardingPage });
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const TARGET_MONTHS = [2, 3, 4, 6, 9, 12] as const;
type Level = (typeof LEVELS)[number];
type TargetMonths = (typeof TARGET_MONTHS)[number];
type RpcError = { message: string };
type PlannerRpcResult = { error: RpcError | null };
type PlannerClient = {
  rpc(
    name: "create_or_replace_study_plan",
    params: { p_target_level: Level; p_target_date: string; p_daily_minutes: number },
  ): Promise<PlannerRpcResult>;
  rpc(name: "generate_daily_study_tasks", params: Record<string, never>): Promise<PlannerRpcResult>;
};

function isLevel(value: string): value is Level {
  return LEVELS.some((level) => level === value);
}
function isTargetMonths(value: number): value is TargetMonths {
  return TARGET_MONTHS.some((months) => months === value);
}
function plusMonths(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function OnboardingPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("N5");
  const [targetMonths, setTargetMonths] = useState<TargetMonths>(3);
  const [country, setCountry] = useState("Indonesia");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const metadata = data.user?.user_metadata ?? {};
      setName(String(metadata.full_name ?? metadata.name ?? ""));
    });
  }, []);

  const save = async () => {
    if (name.trim().length < 2) return toast.error("Nama minimal 2 karakter.");
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sesi tidak ditemukan.");

      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim(), target_level: level, country, onboarding_completed: true })
        .eq("id", auth.user.id);
      if (error) throw error;

      const targetDate = plusMonths(targetMonths);
      const plannerClient = supabase as unknown as PlannerClient;
      const { error: planError } = await plannerClient.rpc("create_or_replace_study_plan", {
        p_target_level: level,
        p_target_date: targetDate,
        p_daily_minutes: 45,
      });
      if (planError) throw new Error(`Rencana belajar gagal dibuat: ${planError.message}`);

      const { error: taskError } = await plannerClient.rpc("generate_daily_study_tasks", {});
      if (taskError) throw new Error(`Target harian gagal dibuat: ${taskError.message}`);

      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          display_name: name.trim(),
          onboarding_completed: true,
          target_level: level,
          country,
          study_target_months: targetMonths,
          study_target_date: targetDate,
        },
      });
      if (metaError) throw metaError;

      toast.success("Akun siap digunakan.");
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan akun.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Siapkan Akun" compact>
      <div className="mx-auto max-w-md">
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 p-5">
            <div>
              <h1 className="text-lg font-bold">Selamat datang di ENO NIHONGO</h1>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Isi data dasar agar Adaptive Study Planner dapat menyusun target belajar sesuai akunmu.
              </p>
            </div>
            <label className="block text-[11px] font-semibold">
              Nama
              <Input className="mt-1" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama pengguna" />
            </label>
            <label className="block text-[11px] font-semibold">
              Level bahasa
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]"
                value={level}
                onChange={(event) => {
                  if (isLevel(event.target.value)) setLevel(event.target.value);
                }}
              >
                {LEVELS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="block text-[11px] font-semibold">
              Target berapa bulan
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]"
                value={targetMonths}
                onChange={(event) => {
                  const months = Number(event.target.value);
                  if (isTargetMonths(months)) setTargetMonths(months);
                }}
              >
                {TARGET_MONTHS.map((item) => <option key={item} value={item}>{item} bulan</option>)}
              </select>
            </label>
            <label className="block text-[11px] font-semibold">
              Negara
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              >
                {COUNTRIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <p className="rounded-xl bg-primary/5 p-3 text-[10px] leading-4 text-muted-foreground">
              ENO NIHONGO akan menghitung target harian berdasarkan level dan target {targetMonths} bulan. Target ini dapat diubah lagi dari profil.
            </p>
            <Button className="w-full rounded-xl" disabled={saving} onClick={() => void save()}>
              {saving ? "Menyimpan…" : "Mulai Belajar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
