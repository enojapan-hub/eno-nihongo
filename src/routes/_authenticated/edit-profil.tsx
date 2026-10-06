import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Globe2,
  Save,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SocialAccountCard } from "@/components/social/SocialAccountCard";
import { getMyAccount, updateMyAccount } from "@/lib/profile.functions";
import { COUNTRIES } from "@/lib/countries";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";

export const Route = createFileRoute("/_authenticated/edit-profil")({ component: EditProfilePage });
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const TARGET_MONTHS = [2, 3, 4, 6, 9, 12] as const;
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
  const [data, setData] = useState({
    display_name: "",
    target_level: "N5",
    ui_language: "id",
    country: "Indonesia",
    bio: "",
    target_months: 3,
    study_days: 5,
  });
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState<typeof data | null>(null);
  const [plan, setPlan] = useState<{ level: string; days: number } | null>(null);
  const [initialMonths, setInitialMonths] = useState<number | null>(null);
  useEffect(() => {
    if (account.data?.profile)
      setData((v) => ({
        ...v,
        display_name: account.data.profile.display_name ?? "",
        target_level: account.data.profile.target_level ?? "N5",
        ui_language: account.data.profile.ui_language ?? "id",
        country: account.data.profile.country ?? "Indonesia",
        bio: account.data.profile.bio ?? "",
      }));
  }, [account.data]);
  useEffect(() => {
    void (async () => {
      const { data: auth } = await getAuthUser();
      if (!auth.user) return;
      const { data: plan } = await supabase
        .from("study_plans")
        .select("target_level,study_days_per_week")
        .eq("user_id", auth.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const days = Number(plan?.study_days_per_week);
      if (plan)
        setPlan({ level: String(plan.target_level), days: days >= 1 && days <= 7 ? days : 7 });
      if (days >= 1 && days <= 7) setData((v) => ({ ...v, study_days: days }));
    })();
  }, []);
  useEffect(() => {
    void getAuthUser().then(({ data: auth }) => {
      const months = Number(auth.user?.user_metadata?.["study_target_months"]);
      setInitialMonths((TARGET_MONTHS as readonly number[]).includes(months) ? months : 3);
      if ((TARGET_MONTHS as readonly number[]).includes(months))
        setData((v) => ({ ...v, target_months: months }));
    });
  }, []);
  const targetDate = plusMonths(data.target_months);
  // Potret awal formulir diambil sekali saat profil, bulan target, dan rencana siap; data terbaru lewat ref.
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    if (
      account.data?.profile &&
      initialMonths !== null &&
      (!plan || dataRef.current.study_days === plan.days)
    ) {
      setInitialData(dataRef.current);
    }
  }, [account.data?.profile, initialMonths, plan]);
  const dirty = initialData !== null && JSON.stringify(data) !== JSON.stringify(initialData);
  const save = async () => {
    if (data.display_name.trim().length < 2) {
      toast.error("Nama minimal 2 karakter.");
      return;
    }
    const s = account.data?.settings;
    if (!s) return;
    setSaving(true);
    try {
      await updateMyAccount({
        data: {
          display_name: data.display_name.trim(),
          target_level: data.target_level as (typeof LEVELS)[number],
          ui_language: data.ui_language as "id" | "en" | "ja",
          country: data.country,
          bio: data.bio.trim(),
          daily_kanji_target: s.daily_kanji_target ?? 5,
          daily_vocab_target: s.daily_vocab_target ?? 10,
          daily_grammar_target: s.daily_grammar_target ?? 5,
          furigana_enabled: s.furigana_enabled ?? true,
          daily_reminder: s.daily_reminder ?? false,
        },
      });
      const client = supabase;
      const keepPlan =
        Boolean(plan) &&
        initialMonths !== null &&
        data.target_level === plan?.level &&
        data.target_months === initialMonths;
      if (keepPlan) {
        const { error: daysError } = await client.rpc("update_study_days_per_week", {
          p_days: data.study_days,
        });
        if (daysError) throw new Error(`Hari belajar gagal diperbarui: ${daysError.message}`);
      } else {
        const { error: planError } = await client.rpc("create_or_replace_study_plan", {
          p_target_level: data.target_level as (typeof LEVELS)[number],
          p_target_date: targetDate,
          p_daily_minutes: 45,
          p_study_days: data.study_days,
        });
        if (planError) throw new Error(`Rencana belajar gagal dibuat: ${planError.message}`);
      }
      const { error: taskError } = await client.rpc("generate_weekly_study_plan");
      if (taskError) throw new Error(`Target harian gagal dibuat: ${taskError.message}`);
      await client.rpc("sync_daily_study_task_progress");
      const { error: metaError } = await supabase.auth.updateUser({
        data: keepPlan
          ? {
              display_name: data.display_name.trim(),
              target_level: data.target_level,
              country: data.country,
            }
          : {
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
        qc.invalidateQueries({ queryKey: ["my-account"] }),
        qc.invalidateQueries({ queryKey: ["my-account-profile"] }),
        qc.invalidateQueries({ queryKey: ["my-account-edit"] }),
      ]);
      toast.success(
        keepPlan
          ? `Hari belajar diperbarui: ${data.study_days} hari/minggu. Target dan progres tetap.`
          : `Adaptive Study Planner aktif: ${data.target_level} · ${data.target_months} bulan.`,
      );
      await navigate({ to: "/profil" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <AppShell title="Edit Profil" backTo="/profil" compact>
      <div className="mx-auto max-w-lg space-y-4 pb-6">
        <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[.10] via-card to-card p-5">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {account.data?.profile?.avatar_url ? (
                <img
                  src={account.data.profile.avatar_url}
                  alt="Foto profil"
                  className="size-20 rounded-3xl border-2 border-background object-cover shadow-sm"
                />
              ) : (
                <div className="grid size-20 place-items-center rounded-3xl bg-primary/10 text-primary">
                  <UserRound className="size-8" />
                </div>
              )}
              <Link
                to="/profil-foto"
                aria-label="Ganti foto profil"
                className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-xl border-2 border-background bg-primary text-primary-foreground"
              >
                <Camera className="size-3.5" />
              </Link>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Profil Belajar
              </p>
              <h1 className="mt-1 truncate text-xl font-bold">
                {data.display_name || "Profil ENO NIHONGO"}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Target JLPT {data.target_level} · {data.study_days} hari belajar/minggu
              </p>
              <Link
                to="/profil-foto"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
              >
                Ganti foto <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>
        </section>

        <Card className="rounded-3xl shadow-none">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" />
              <div>
                <h2 className="text-sm font-bold">Profil</h2>
                <p className="text-[10px] text-muted-foreground">
                  Informasi yang tampil di akun Anda.
                </p>
              </div>
            </div>
            <label className="block text-xs font-semibold">
              Nama tampilan
              <Input
                maxLength={60}
                className="mt-1.5 h-11 rounded-xl"
                value={data.display_name}
                onChange={(e) => setData((v) => ({ ...v, display_name: e.target.value }))}
              />
              <span className="mt-1 block text-right text-[9px] font-normal text-muted-foreground">
                {data.display_name.length}/60
              </span>
            </label>
            <div>
              <p className="text-xs font-semibold">Negara</p>
              <select
                className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                value={data.country}
                onChange={(e) => setData((v) => ({ ...v, country: e.target.value }))}
              >
                {COUNTRIES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <label className="block text-xs font-semibold">
              Bio
              <Textarea
                maxLength={160}
                rows={3}
                placeholder="Ceritakan sedikit tentang dirimu..."
                className="mt-1.5 min-h-[5.5rem] resize-none rounded-xl text-sm"
                value={data.bio}
                onChange={(e) => setData((v) => ({ ...v, bio: e.target.value }))}
              />
              <span className="mt-1 block text-right text-[9px] font-normal text-muted-foreground">
                {data.bio.length}/160
              </span>
            </label>
            <div className="flex items-center gap-3 rounded-2xl bg-muted/40 px-3 py-3">
              <Globe2 className="size-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold">Bahasa aplikasi</p>
                <p className="text-[10px] text-muted-foreground">Bahasa Indonesia</p>
              </div>
              <Check className="ml-auto size-4 text-primary" />
            </div>
          </CardContent>
        </Card>

        <SocialAccountCard />

        <Card className="rounded-3xl shadow-none">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              <div>
                <h2 className="text-sm font-bold">Target JLPT</h2>
                <p className="text-[10px] text-muted-foreground">
                  Materi dan rekomendasi belajar mengikuti target ini.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {LEVELS.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setData((v) => ({ ...v, target_level: x }))}
                  className={`h-11 rounded-xl border text-sm font-bold transition-colors ${data.target_level === x ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/30"}`}
                  aria-pressed={data.target_level === x}
                >
                  {x}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold">
                Target waktu
                <select
                  className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                  value={data.target_months}
                  onChange={(e) =>
                    setData((v) => ({ ...v, target_months: Number(e.target.value) }))
                  }
                >
                  {TARGET_MONTHS.map((x) => (
                    <option key={x} value={x}>
                      {x} bulan
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold">
                Hari belajar
                <select
                  className="mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                  value={data.study_days}
                  onChange={(e) => setData((v) => ({ ...v, study_days: Number(e.target.value) }))}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((x) => (
                    <option key={x} value={x}>
                      {x} hari/minggu
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/[.05] p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-bold">Adaptive Study Planner</p>
                  <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                    Rencana {data.target_level} disusun untuk {data.target_months} bulan dengan{" "}
                    {data.study_days} hari belajar per minggu. Progres yang sudah selesai tetap
                    dipertahankan.
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
                    <CalendarDays className="size-3.5" />
                    Perkiraan target {formatDate(targetDate)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-2xl border bg-card px-4 py-3">
          <p className="text-[10px] leading-5 text-muted-foreground">
            {dirty ? "Ada perubahan yang belum disimpan." : "Profil Anda sudah tersimpan."}
          </p>
        </div>
        <Button
          className="h-11 w-full rounded-xl"
          disabled={saving || !dirty || data.display_name.trim().length < 2}
          onClick={() => void save()}
        >
          <Save className="mr-2 size-4" />
          {saving ? "Menyimpan perubahan…" : "Simpan Perubahan"}
        </Button>
      </div>
    </AppShell>
  );
}
