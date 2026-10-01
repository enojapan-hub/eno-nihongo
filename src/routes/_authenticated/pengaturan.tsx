import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  BookOpenCheck,
  CircleHelp,
  Globe2,
  Instagram,
  LogOut,
  MessageSquareText,
  Moon,
  Music2,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
  X,
  GraduationCap,
  FilePenLine,
  Crown,
  ChevronRight,
  Target,
  LifeBuoy,
  LockKeyhole,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/_authenticated/pengaturan")({ component: Page });
function Row({
  icon: I,
  title,
  desc,
  onClick,
  children,
}: {
  icon: any;
  title: string;
  desc: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-primary/[.04] active:scale-[.99]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
        <I className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[12px]">{title}</b>
        <span className="mt-0.5 block text-[9px] leading-4 text-muted-foreground">{desc}</span>
      </span>
      {children ?? (
        <ChevronRight className="size-4 text-muted-foreground/60 transition group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[.14em] text-muted-foreground">
        {title}
      </p>
      <Card className="rounded-[1.6rem] shadow-sm">
        <CardContent className="divide-y p-1.5">{children}</CardContent>
      </Card>
    </section>
  );
}
function Info({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[1.7rem] border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <CircleHelp className="size-4" />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-black">{title}</h2>
            <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{text}</p>
          </div>
          <button onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
function Report({ close }: { close: () => void }) {
  const [cat, setCat] = useState("bug"),
    [subject, setSubject] = useState(""),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("submit_user_report", {
      p_category: cat,
      p_subject: subject,
      p_description: description,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Laporan terkirim ke tim ENO NIHONGO.");
    close();
  }
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" onClick={close}>
      <div
        className="w-full max-w-sm space-y-3 rounded-[1.7rem] border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between">
          <div>
            <h2 className="text-sm font-black">Kirim Laporan</h2>
            <p className="text-[9px] text-muted-foreground">
              Laporan masuk langsung ke Kontrol Operasional.
            </p>
          </div>
          <button onClick={close}>
            <X className="size-4" />
          </button>
        </div>
        <select
          className="h-10 w-full rounded-xl border bg-background px-3 text-xs"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="bug">Bug / tampilan</option>
          <option value="content">Materi</option>
          <option value="account">Akun</option>
          <option value="payment">Pembayaran</option>
          <option value="suggestion">Saran</option>
          <option value="other">Lainnya</option>
        </select>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subjek" />
        <textarea
          className="min-h-28 w-full rounded-xl border bg-background p-3 text-xs"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Jelaskan masalah secara rinci…"
        />
        <button
          disabled={busy || subject.trim().length < 3 || description.trim().length < 10}
          onClick={send}
          className="h-10 w-full rounded-xl bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Mengirim…" : "Kirim Laporan"}
        </button>
      </div>
    </div>
  );
}
function Page() {
  const qc = useQueryClient(),
    [role, setRole] = useState(""),
    [dark, setDark] = useState(() => localStorage.getItem("enonihongo-theme") === "dark"),
    [reminder, setReminder] = useState(false),
    [modal, setModal] = useState<{ title: string; text: string } | null>(null),
    [report, setReport] = useState(false);
  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: p }, { data: n }] = await Promise.all([
        (supabase as any).from("profiles").select("role").eq("id", user.id).maybeSingle(),
        (supabase as any).rpc("get_my_notification_settings"),
      ]);
      setRole(p?.role ?? "student");
      setReminder(Boolean(n?.daily_reminder));
    })();
  }, []);
  async function notify(v: boolean) {
    setReminder(v);
    const { error } = await (supabase as any).rpc("set_my_daily_reminder", { p_enabled: v });
    if (error) {
      setReminder(!v);
      toast.error(error.message);
    } else toast.success(v ? "Pengingat belajar diaktifkan." : "Pengingat belajar dinonaktifkan.");
  }
  function theme(v: boolean) {
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    localStorage.setItem("enonihongo-theme", v ? "dark" : "light");
  }
  async function refresh() {
    await qc.invalidateQueries();
    toast.success("Data terbaru berhasil dimuat.");
  }
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }
  const admin = role === "admin" || role === "owner";
  return (
    <AppShell title="Pengaturan" backTo="/profil" compact>
      <div className="mx-auto max-w-md space-y-5 pb-8">
        <section className="rounded-[2rem] bg-gradient-to-br from-emerald-950 to-primary p-5 text-white shadow-lg">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/65">
            ENO NIHONGO
          </p>
          <h1 className="mt-1 text-xl font-black">Pengaturan</h1>
          <p className="mt-1 text-[10px] leading-5 text-white/70">
            Atur pengalaman belajar, akun, bantuan, dan akses aplikasi.
          </p>
        </section>
        {(admin || role === "editor" || role === "teacher") && (
          <Section title="Akses Khusus">
            {admin && (
              <Row
                icon={ShieldCheck}
                title="Panel Admin"
                desc="Administrasi dan kontrol platform."
                onClick={() => (location.href = "/admin")}
              />
            )}{" "}
            {(role === "owner" || role === "admin" || role === "editor") && (
              <Row
                icon={FilePenLine}
                title="Panel Editor"
                desc="Kelola materi, simulasi dan review konten."
                onClick={() => (location.href = "/editor")}
              />
            )}{" "}
            {(role === "owner" || role === "admin" || role === "teacher") && (
              <Row
                icon={GraduationCap}
                title="Panel Guru"
                desc="Kelola kelas, peserta dan aktivitas guru."
                onClick={() => (location.href = "/guru")}
              />
            )}
          </Section>
        )}
        <Section title="Belajar & Aplikasi">
          <Row
            icon={Target}
            title="Target Belajar"
            desc="Level JLPT, durasi target dan hari belajar."
            onClick={() => (location.href = "/edit-profil")}
          />
          <Row
            icon={Bell}
            title="Pengingat Belajar"
            desc="Tersimpan di akun dan berlaku lintas perangkat."
          >
            <span onClick={(e) => e.stopPropagation()}>
              <Switch checked={reminder} onCheckedChange={notify} />
            </span>
          </Row>
          <Row
            icon={dark ? Sun : Moon}
            title="Mode Tampilan"
            desc={dark ? "Mode gelap aktif" : "Mode terang aktif"}
          >
            <span onClick={(e) => e.stopPropagation()}>
              <Switch checked={dark} onCheckedChange={theme} />
            </span>
          </Row>
          <Row
            icon={RefreshCw}
            title="Segarkan Data"
            desc="Sinkronkan data terbaru dari server."
            onClick={refresh}
          />
        </Section>
        <Section title="Akun">
          <Row
            icon={Crown}
            title="Paket Premium"
            desc="Bulanan, Tahunan atau Lifetime."
            onClick={() => (location.href = "/paket")}
          />
          <Row
            icon={UserRound}
            title="Edit Profil"
            desc="Nama, foto profil, level dan negara."
            onClick={() => (location.href = "/edit-profil")}
          />
          <Row
            icon={LockKeyhole}
            title="Keamanan & Privasi"
            desc="Informasi keamanan akun dan penggunaan data."
            onClick={() =>
              setModal({
                title: "Keamanan & Privasi",
                text: "Akses ENO NIHONGO dilindungi autentikasi akun. Jangan membagikan akses akun. Data profil dan progres digunakan untuk menjalankan fitur belajar. Keluar dari perangkat ini jika menggunakan perangkat bersama.",
              })
            }
          />
          <Row
            icon={LogOut}
            title="Keluar"
            desc="Keluar dari akun pada perangkat ini."
            onClick={() => {
              if (confirm("Keluar dari akun ENO NIHONGO?")) void logout();
            }}
          />
        </Section>
        <Section title="Bantuan">
          <Row
            icon={BookOpenCheck}
            title="Panduan Penggunaan"
            desc="Cara memulai dan menggunakan fitur utama."
            onClick={() =>
              setModal({
                title: "Panduan Penggunaan",
                text: "Mulai dari Target Belajar untuk menentukan level dan jadwal. Gunakan Materi untuk Kanji, Kotoba, Bunpou, Dokkai dan Choukai. Kioku membantu review, sedangkan Simulasi mengukur kemampuan JLPT. Progresmu tersimpan otomatis.",
              })
            }
          />
          <Row
            icon={MessageSquareText}
            title="Laporkan Masalah"
            desc="Kirim bug, masalah materi, akun atau pembayaran."
            onClick={() => setReport(true)}
          />
          <Row
            icon={LifeBuoy}
            title="Layanan Pelanggan"
            desc="enoinjapan@gmail.com"
            onClick={() => (location.href = "mailto:enoinjapan@gmail.com")}
          />
          <Row
            icon={CircleHelp}
            title="FAQ"
            desc="Jawaban singkat pertanyaan umum."
            onClick={() =>
              setModal({
                title: "FAQ",
                text: "Progres belajar tersimpan di akun. Paket Premium membuka fitur membership dan akses belajar tambahan. Jika menemukan materi atau fungsi yang bermasalah, gunakan Laporkan Masalah agar laporan masuk langsung ke tim.",
              })
            }
          />
        </Section>
        <Section title="ENO NIHONGO">
          <Row
            icon={Globe2}
            title="Tentang ENO NIHONGO"
            desc="Platform belajar bahasa Jepang N5–N1."
            onClick={() =>
              setModal({
                title: "Tentang ENO NIHONGO",
                text: "ENO NIHONGO adalah platform belajar bahasa Jepang untuk pengguna Indonesia, dengan materi N5–N1, adaptive study planner, review, latihan dan simulasi JLPT.",
              })
            }
          />
          <Row
            icon={Instagram}
            title="Instagram"
            desc="@enottf"
            onClick={() =>
              window.open("https://www.instagram.com/enottf/", "_blank", "noopener,noreferrer")
            }
          />
          <Row
            icon={Music2}
            title="TikTok"
            desc="@enottff"
            onClick={() =>
              window.open("https://www.tiktok.com/@enottff", "_blank", "noopener,noreferrer")
            }
          />
        </Section>
        <p className="text-center text-[9px] text-muted-foreground">ENO NIHONGO · V1</p>
      </div>
      {modal && <Info {...modal} onClose={() => setModal(null)} />}{" "}
      {report && <Report close={() => setReport(false)} />}
    </AppShell>
  );
}
