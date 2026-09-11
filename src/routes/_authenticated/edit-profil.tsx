import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CalendarDays, Camera, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getMyAccount,
  updateMyAccount,
  type ProfileSettingsInput,
} from "@/lib/profile.functions";
import { COUNTRIES } from "@/lib/countries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/edit-profil")({ component: EditProfilePage });
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const UI_LANGUAGES = ["id", "en", "ja"] as const;
const TARGET_MONTHS = [2, 3, 4, 6, 9, 12] as const;
type Level = (typeof LEVELS)[number];
type UiLanguage = (typeof UI_LANGUAGES)[number];
type TargetMonths = (typeof TARGET_MONTHS)[number];
type FormData = {
  display_name: string;
  target_level: Level;
  ui_language: UiLanguage;
  country: string;
  target_months: TargetMonths;
};
type RpcError = { message: string };
type PlannerRpcResult = { error: RpcError | null };
type PlannerClient = {
  rpc(
    name: "create_or_replace_study_plan",
    params: { p_target_level: Level; p_target_date: string; p_daily_minutes: number },
  ): Promise<PlannerRpcResult>;
  rpc(
    name: "generate_daily_study_tasks" | "sync_daily_study_task_progress",
    params: { p_study_date: string },
  ): Promise<PlannerRpcResult>;
};

function isLevel(value: string): value is Level {
  return LEVELS.some((level) => level === value);
}
function isUiLanguage(value: string): value is UiLanguage {
  return UI_LANGUAGES.some((language) => language === value);
}
function isTargetMonths(value: number): value is TargetMonths {
  return TARGET_MONTHS.some((months) => months === value);
}
function plusMonths(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(`${date}T00:00:00+09:00`));
}

function EditProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const account = useQuery({ queryKey: ["my-account-edit"], queryFn: () => getMyAccount() });
  const [data, setData] = useState<FormData>({
    display_name: "",
    target_level: "N5",
    ui_language: "id",
    country: "Indonesia",
    target_months: 3,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!account.data?.profile) return;
    const profile = account.data.profile;
    setData((value) => ({
      ...value,
      display_name: profile.display_name ?? "",
      target_level: profile.target_level ?? "N5",
      ui_language: isUiLanguage(profile.ui_language ?? "") ? profile.ui_language : "id",
      country: profile.country ?? "Indonesia",
    }));
  }, [account.data]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: auth }) => {
      const months = Number(auth.user?.user_metadata?.study_target_months);
      if (isTargetMonths(months)) setData((value) => ({ ...value, target_months: months }));
    });
  }, []);

  const targetDate = plusMonths(data.target_months);
  const save = async () => {
    if (data.display_name.trim().length < 2) return toast.error("Nama minimal 2 karakter.");
    const settings = account.data?.settings;
    if (!settings) return;
    setSaving(true);
    try {
      const profileInput: ProfileSettingsInput = {
        display_name: data.display_name.trim(),
        target_level: data.target_level,
        ui_language: data.ui_language,
        country: data.country,
        daily_kanji_target: settings.daily_kanji_target ?? 5,
        daily_vocab_target: settings.daily_vocab_target ?? 10,
        daily_grammar_target: settings.daily_grammar_target ?? 5,
        furigana_enabled: settings.furigana_enabled ?? true,
        daily_reminder: settings.daily_reminder ?? false,
      };
      await updateMyAccount({ data: profileInput });

      const plannerClient = supabase as unknown as PlannerClient;
      const { error: planError } = await plannerClient.rpc("create_or_replace_study_plan", {
        p_target_level: data.target_level,
        p_target_date: targetDate,
        p_daily_minutes: 45,
      });
      if (planError) throw new Error(`Rencana belajar gagal dibuat: ${planError.message}`);

      const { error: taskError } = await plannerClient.rpc("generate_daily_study_tasks", {
        p_study_date: targetDate,
      });
      if (taskError) throw new Error(`Target harian gagal dibuat: ${taskError.message}`);

      const { error: syncError } = await plannerClient.rpc("sync_daily_study_task_progress", {
        p_study_date: targetDate,
      });
      if (syncError) throw new Error(`Progres target gagal disinkronkan: ${syncError.message}`);

      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          display_name: data.display_name.trim(),
          target_level: data.target_level,
          country: data.country,
          study_target_months: data.target_months,
          study_target_date: targetDate,
        },
      });
      if (metaError) throw metaError;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["adaptive-plan"] }),
        qc.invalidateQueries({ queryKey: ["target-level"] }),
        qc.invalidateQueries({ queryKey: ["my-account-profile"] }),
        qc.invalidateQueries({ queryKey: ["my-account-edit"] }),
      ]);
      toast.success(`Adaptive Study Planner aktif: ${data.target_level} · ${data.target_months} bulan.`);
      await navigate({ to: "/profil" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Edit Profil" backTo="/profil" compact>
      <div className="mx-auto max-w-md space-y-3">
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-14 place-items-center overflow-hidden rounded-full border bg-muted">
                {account.data?.profile?.avatar_url ? (
                  <img src={account.data.profile.avatar_url} alt="Foto profil" className="size-full object-cover" />
                ) : (
                  <Camera className="size-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-[12px] font-semibold">Foto profil</p>
                <Button asChild variant="outline" size="sm" className="mt-1 h-8 text-[10px]">
                  <Link to="/profil-foto">Ganti foto</Link>
                </Button>
              </div>
            </div>
            <label className="block text-[11px] font-semibold">
              Nama
              <Input
                className="mt-1"
                value={data.display_name}
                onChange={(event) => setData((value) => ({ ...value, display_name: event.target.value }))}
              />
            </label>
            <label className="block text-[11px] font-semibold">
              Target level JLPT
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]"
                value={data.target_level}
                onChange={(event) => {
                  if (isLevel(event.target.value)) {
                    setData((value) => ({ ...value, target_level: event.target.value }));
                  }
                }}
              >
                {LEVELS.map((level) => <option key={level}>{level}</option>)}
              </select>
            </label>
            <label className="block text-[11px] font-semibold">
              Target berapa bulan
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]"
                value={data.target_months}
                onChange={(event) => {
                  const months = Number(event.target.value);
                  if (isTargetMonths(months)) setData((value) => ({ ...value, target_months: months }));
                }}
              >
                {TARGET_MONTHS.map((months) => <option key={months} value={months}>{months} bulan</option>)}
              </select>
            </label>
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.06] p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-[11px] font-bold text-primary">Adaptive Study Planner</p>
                  <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                    Target harian akan dihitung ulang untuk menyelesaikan {data.target_level} dalam {data.target_months} bulan. Progres yang sudah selesai tetap dipertahankan.
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold">
                    <CalendarDays className="size-3.5" />Perkiraan target: {formatDate(targetDate)}
                  </p>
                </div>
              </div>
            </div>
            <label className="block text-[11px] font-semibold">
              Bahasa aplikasi
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]"
                value={data.ui_language}
                onChange={(event) => {
                  if (isUiLanguage(event.target.value)) {
                    setData((value) => ({ ...value, ui_language: event.target.value }));
                  }
                }}
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </label>
            <label className="block text-[11px] font-semibold">
              Negara
              <select
                className="mt-1 h-10 w-full rounded-xl border bg-background px-3 text-[12px]"
                value={data.country}
                onChange={(event) => setData((value) => ({ ...value, country: event.target.value }))}
              >
                {COUNTRIES.map((country) => <option key={country}>{country}</option>)}
              </select>
            </label>
            <Button className="w-full rounded-xl" disabled={saving} onClick={() => void save()}>
              <Save className="mr-2 size-4" />{saving ? "Menyusun ulang rencana…" : "Simpan & Aktifkan Planner"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
