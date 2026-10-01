import { useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ImagePlus, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/guru-kelas-baru")({ component: Page });

const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function Page() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({
    title: "",
    level: "N4",
    description: "",
    banner_url: "",
    class_mode: "live",
    meeting_url: "",
    first_date: "",
    meeting_count: "8",
    weekday: "6",
    start_time: "09:00",
    end_time: "10:30",
    capacity: "20",
    price: "0",
  });
  const set = (key: string, value: string) => setF((current) => ({ ...current, [key]: value }));

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Banner harus JPG, PNG, atau WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran banner maksimal 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Login diperlukan");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = user.id + "/" + Date.now() + "-" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await supabase.storage
        .from("class-banners")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("class-banners").getPublicUrl(path);
      set("banner_url", data.publicUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload banner gagal.");
    } finally {
      setUploading(false);
    }
  }

  function makeSessions() {
    const count = Number(f.meeting_count);
    if (!f.first_date || !Number.isInteger(count) || count < 1 || count > 60)
      throw new Error("Isi tanggal mulai dan jumlah pertemuan (1–60).");
    const [year = 0, month = 0, date = 0] = f.first_date.split("-").map(Number);
    const first = new Date(year, month - 1, date);
    const targetDay = Number(f.weekday);
    if (first.getDay() !== targetDay)
      throw new Error("Tanggal pertemuan pertama harus sesuai dengan hari yang dipilih.");

    const [startHour = NaN, startMinute = NaN] = f.start_time.split(":").map(Number);
    const [endHour = NaN, endMinute = NaN] = f.end_time.split(":").map(Number);
    if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite))
      throw new Error("Isi jam mulai dan selesai.");
    if (endHour * 60 + endMinute <= startHour * 60 + startMinute)
      throw new Error("Jam selesai harus setelah jam mulai.");
    return Array.from({ length: count }, (_, index) => {
      const day = new Date(first);
      day.setDate(first.getDate() + index * 7);
      const starts = new Date(day);
      starts.setHours(startHour, startMinute, 0, 0);
      const ends = new Date(day);
      ends.setHours(endHour, endMinute, 0, 0);
      return {
        title: "Pertemuan " + (index + 1),
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      };
    });
  }

  async function save(status: "draft" | "review") {
    setBusy(true);
    setError("");
    try {
      const sessions = makeSessions();
      const { error: createError } = await supabase.rpc(
        "teacher_create_class_with_sessions",
        {
          p_data: {
            title: f.title.trim(),
            level: f.level,
            description: f.description || null,
            banner_url: f.banner_url || null,
            meeting_url: f.meeting_url || null,
            capacity: Number(f.capacity),
            price: Number(f.price),
            status,
          },
          p_sessions: sessions,
        },
      );
      if (createError) throw createError;
      await nav({ to: "/guru" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kelas gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Buka Kelas" backTo="/guru">
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <h1 className="text-xl font-black">Buka Kelas Baru</h1>
          <p className="text-xs text-muted-foreground">
            Tentukan jumlah sesi dan jadwal mingguan. Ajukan kelas ke Admin setelah siap.
          </p>
        </div>
        <Field label="Nama kelas">
          <Input
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="JLPT N4 Intensive"
          />
        </Field>
        <Field label="Level">
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={f.level}
            onChange={(e) => set("level", e.target.value)}
          >
            {["N5", "N4", "N3", "N2", "N1"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Deskripsi">
          <textarea
            className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="Banner kelas">
          {f.banner_url ? (
            <div className="space-y-2">
              <img
                src={f.banner_url}
                alt="Preview banner kelas"
                className="aspect-[16/7] w-full rounded-2xl border object-cover"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => set("banner_url", "")}
              >
                Ganti banner
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-7 text-center hover:bg-muted/40">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(e) => upload(e.target.files?.[0])}
              />
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : (
                <ImagePlus className="size-6 text-primary" />
              )}
              <span className="mt-2 text-xs font-bold">
                {uploading ? "Mengunggah…" : "Upload banner"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                JPG, PNG, WebP · maksimal 5 MB
              </span>
            </label>
          )}
        </Field>
        <div className="rounded-2xl border p-3">
          <h2 className="text-sm font-black">Jadwal pertemuan</h2>
          <p className="mb-3 text-[10px] text-muted-foreground">
            Pertemuan berulang tiap minggu pada hari dan jam yang dipilih. Tanggal pertama harus
            sesuai dengan hari tersebut.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pertemuan pertama">
              <Input
                type="date"
                value={f.first_date}
                onChange={(e) => set("first_date", e.target.value)}
              />
            </Field>
            <Field label="Jumlah pertemuan">
              <Input
                type="number"
                min="1"
                max="60"
                value={f.meeting_count}
                onChange={(e) => set("meeting_count", e.target.value)}
              />
            </Field>
            <Field label="Setiap hari">
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={f.weekday}
                onChange={(e) => set("weekday", e.target.value)}
              >
                {days.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jam mulai">
              <Input
                type="time"
                value={f.start_time}
                onChange={(e) => set("start_time", e.target.value)}
              />
            </Field>
            <Field label="Jam selesai">
              <Input
                type="time"
                value={f.end_time}
                onChange={(e) => set("end_time", e.target.value)}
              />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kapasitas">
            <Input
              type="number"
              min="1"
              value={f.capacity}
              onChange={(e) => set("capacity", e.target.value)}
            />
          </Field>
          <Field label="Harga (IDR)">
            <Input
              type="number"
              min="0"
              value={f.price}
              onChange={(e) => set("price", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Link Zoom / Meet">
          <Input
            value={f.meeting_url}
            onChange={(e) => set("meeting_url", e.target.value)}
            placeholder="Hanya terlihat oleh anggota kelas"
          />
        </Field>
        {error && (
          <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
        )}
        <div className="flex gap-2">
          <Button
            disabled={busy || uploading || !f.title.trim()}
            variant="outline"
            onClick={() => save("draft")}
          >
            Simpan Draft
          </Button>
          <Button disabled={busy || uploading || !f.title.trim()} onClick={() => save("review")}>
            {busy ? "Menyimpan…" : "Ajukan ke Admin"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold">{label}</span>
      {children}
    </label>
  );
}
