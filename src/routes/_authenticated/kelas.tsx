import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, FileText, GraduationCap, Search, ShoppingBag, Sparkles, Users, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAuthUser } from "@/lib/auth-user";

export const Route = createFileRoute("/_authenticated/kelas")({ component: KelasRoute });

function KelasRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return pathname.replace(/\/$/, "") === "/kelas" ? <KelasPage /> : <Outlet />;
}

type DigitalProduct = { id:string; title:string; category:string; description:string|null; price_idr:number|string; file_name:string; related_class_id:string|null };

function KelasPage() {
  const [selectedProduct,setSelectedProduct]=useState<DigitalProduct|null>(null);
  const [deliveryEmail,setDeliveryEmail]=useState("");
  const [emailConfirmed,setEmailConfirmed]=useState(false);
  const rate = useQuery({
    queryKey: ["jpy-idr-rate"],
    queryFn: async () => {
      const response = await fetch("https://api.frankfurter.dev/v2/rate/jpy/idr");
      if (!response.ok) throw new Error("Kurs rupiah belum tersedia");
      const result = await response.json();
      return Number(result.rate);
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const classes = useQuery({
    queryKey: ["published-classes"],
    queryFn: async () => {
      const [{ data, error }, { data: counts, error: countError }] = await Promise.all([
        supabase.rpc("get_public_classes"),
        supabase.rpc("get_public_class_enrollment_counts"),
      ]);
      if (error) throw error;
      if (countError) throw countError;
      const byClass = new Map(
        (counts ?? []).map((row) => [row.class_id, Number(row.participant_count)] as const),
      );
      return (data ?? []).map((row) => ({
        ...row,
        participant_count: byClass.get(row.id) ?? 0,
      }));
    },
  });

  const products = useQuery({
    queryKey: ["digital-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("digital_products" as never)
        .select("id,title,category,description,price_idr,file_name,related_class_id")
        .eq("status","published")
        .order("created_at",{ascending:false});
      if (error) throw error;
      return (data ?? []) as unknown as DigitalProduct[];
    },
    retry: false,
  });
  useEffect(() => {
    void getAuthUser().then(({ data }) => setDeliveryEmail(data.user?.email ?? ""));
  }, []);
  const [search, setSearch] = useState("");
  const visibleClasses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classes.data ?? [];
    return (classes.data ?? []).filter((c) =>
      [c.title, c.level, c.description].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [classes.data, search]);

  return (
    <AppShell title="Kelas" compact>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-black">Kelas</h1>
          <Button
            size="sm"
            variant="outline"
            asChild
            className="h-10 rounded-full px-3 text-xs font-bold"
          >
            <Link to="/kelas-saya">
              <GraduationCap className="mr-1.5 size-4" />
              Kelas Saya
            </Link>
          </Button>
        </div>
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-background to-background p-5 shadow-sm sm:p-7">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                <Sparkles className="size-3.5" /> Belajar bersama guru
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                Temukan kelas yang sesuai target JLPT Anda
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Belajar lebih terarah melalui materi, tugas, kuis, jadwal, dan pendampingan guru
                dalam satu ruang kelas.
              </p>
            </div>
            <div className="relative mt-5">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kelas atau level JLPT"
                className="h-12 w-full rounded-2xl border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </section>

          <section aria-labelledby="available-courses">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="available-courses" className="text-lg font-black">
                  Kelas tersedia
                </h2>
                <p className="text-xs text-muted-foreground">
                  {classes.isLoading
                    ? "Memuat kelas…"
                    : `${visibleClasses.length} kelas dapat dipilih`}
                </p>
              </div>
              <BookOpen className="size-5 text-primary" />
            </div>

            {classes.isError && (
              <div className="rounded-2xl border bg-card p-5 text-sm text-destructive">
                Kelas gagal dimuat. Silakan coba lagi.
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleClasses.map((c) => (
                <Link
                  key={c.id}
                  to="/kelas/$classId"
                  params={{ classId: c.id }}
                  aria-label={`Lihat detail kelas ${c.title}`}
                  className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <article>
                    <div className="relative aspect-[16/7] overflow-hidden bg-primary/10">
                      {c.banner_url ? (
                        <img
                          src={c.banner_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center">
                          <GraduationCap className="size-9 text-primary" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-black shadow-sm backdrop-blur">
                        JLPT {c.level}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="line-clamp-2 min-h-10 text-[15px] font-black leading-5">
                        {c.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
                        {c.description || "Belajar terarah bersama guru ENO NIHONGO."}
                      </p>
                      <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3">
                        <div>
                          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Users className="size-3" />
                            {c.participant_count} peserta
                          </p>
                          <strong className="mt-1 block text-base font-black text-primary">
                            {formatPrice(c, rate.data)}
                          </strong>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                          Lihat kelas{" "}
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>

            {!classes.isLoading && !visibleClasses.length && (
              <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
                <GraduationCap className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-bold">
                  {search ? "Kelas tidak ditemukan" : "Belum ada kelas yang dipublikasikan"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {search
                    ? "Coba kata kunci atau level JLPT lain."
                    : "Kelas baru akan tampil di sini setelah dipublikasikan."}
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="digital-products">
            <div className="mb-3">
              <h2 id="digital-products" className="text-lg font-black">Produk Digital</h2>
              <p className="text-xs text-muted-foreground">Materi SSW, e-book, latihan, dan materi tambahan ENO NIHONGO.</p>
            </div>
            {products.isError && <p className="rounded-2xl border p-4 text-xs text-muted-foreground">Produk digital belum tersedia.</p>}
            {!products.isLoading && !products.isError && !products.data?.length && (
              <div className="rounded-2xl border border-dashed bg-card p-6 text-center">
                <FileText className="mx-auto mb-2 size-7 text-primary/60" />
                <p className="text-sm font-bold">Produk belum tersedia</p>
                <p className="mt-1 text-xs text-muted-foreground">Produk digital sedang disiapkan. Silakan periksa kembali nanti.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {products.data?.map((product) => (
                <button key={product.id} type="button" onClick={() => { setSelectedProduct(product); setEmailConfirmed(false); }}
                  className="flex gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><FileText className="size-6"/></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-primary">{product.category}</span>
                    <strong className="mt-0.5 block truncate text-sm">{product.title}</strong>
                    <span className="mt-1 block line-clamp-2 text-[11px] text-muted-foreground">{product.description || "Materi digital ENO NIHONGO."}</span>
                    <span className="mt-2 block text-sm font-black text-primary">{formatIdr(product.price_idr)}</span>
                  </span>
                  <ShoppingBag className="size-4 shrink-0 text-muted-foreground"/>
                </button>
              ))}
            </div>
          </section>
        </div>

        {selectedProduct && (
          <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="digital-product-title">
            <div className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-xl sm:rounded-3xl">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase text-primary">{selectedProduct.category}</p><h2 id="digital-product-title" className="text-lg font-black">{selectedProduct.title}</h2></div>
                <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setSelectedProduct(null)} aria-label="Tutup"><X className="size-4"/></Button>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{selectedProduct.description || "Materi digital ENO NIHONGO."}</p>
              <p className="mt-3 text-xl font-black text-primary">{formatIdr(selectedProduct.price_idr)}</p>
              <label className="mt-5 block text-xs font-bold" htmlFor="delivery-email">Ke mana materi akan dikirim?</label>
              <input id="delivery-email" type="email" value={deliveryEmail} onChange={(e)=>{setDeliveryEmail(e.target.value);setEmailConfirmed(false);}}
                className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                Pastikan alamat email benar dan dapat menerima email. ENO NIHONGO tidak bertanggung jawab atas kegagalan pengiriman materi yang disebabkan oleh kesalahan penulisan alamat email oleh pembeli.
              </p>
              <label className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs">
                <input type="checkbox" checked={emailConfirmed} onChange={(e)=>setEmailConfirmed(e.target.checked)} className="mt-0.5"/>
                <span>Saya telah memeriksa dan memastikan alamat email di atas sudah benar.</span>
              </label>
              <Button className="mt-4 w-full" disabled title="Duitku masih dinonaktifkan">
                Lanjut ke Pembayaran
              </Button>
              <p className="mt-2 text-center text-[10px] text-muted-foreground">Pembayaran akan dibuka setelah sistem pembayaran ENO NIHONGO diaktifkan.</p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function formatIdr(value: number | string) {
  return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value));
}

function formatPrice(c: { price: number | string; currency: string }, rate?: number) {
  if (Number(c.price) <= 0) return "Gratis";
  if (c.currency === "JPY")
    return rate
      ? "≈ " +
          new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
          }).format(Number(c.price) * rate)
      : "Kurs belum tersedia";
  if (c.currency === "IDR")
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(c.price));
  return c.currency + " " + Number(c.price).toLocaleString("id-ID");
}
