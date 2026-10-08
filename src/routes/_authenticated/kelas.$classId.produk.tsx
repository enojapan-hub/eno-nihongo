import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Download, LockKeyhole, PackageOpen, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/kelas/$classId/produk")({ component: Page });

type Product = {
  id: string;
  title: string;
  description: string | null;
  price_idr: number | string;
  cover_path: string | null;
  file_name: string;
};

const rupiah = (value: number | string) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value));

function Page() {
  const { classId } = Route.useParams();
  const products = useQuery({
    queryKey: ["class-digital-products", classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_digital_products" as never)
        .select("id,title,description,price_idr,cover_path,file_name")
        .eq("class_id", classId)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Product[];
    },
  });

  return (
    <AppShell title="Produk Digital" focus>
      <div className="mx-auto max-w-4xl space-y-5 pb-12">
        <header className="flex items-center gap-3">
          <Button size="icon" variant="outline" className="rounded-full" asChild>
            <Link to="/kelas/$classId" params={{ classId }} aria-label="Kembali ke kelas">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-black">Produk Digital</h1>
            <p className="text-xs text-muted-foreground">Materi tambahan resmi dari guru kelas.</p>
          </div>
        </header>

        <div className="flex gap-3 rounded-2xl border border-primary/15 bg-primary/[0.05] p-4">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-xs leading-5 text-muted-foreground">
            File produk bersifat privat. Akses unduhan diberikan hanya setelah pembayaran terverifikasi.
          </p>
        </div>

        {products.isLoading && <p className="text-xs text-muted-foreground">Memuat produk…</p>}
        {products.isError && <p className="text-xs text-destructive">Produk gagal dimuat.</p>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.data?.map((product) => (
            <Card key={product.id} className="overflow-hidden shadow-sm">
              <div className="grid aspect-[16/9] place-items-center bg-primary/10">
                <BookOpen className="size-9 text-primary" />
              </div>
              <CardContent className="p-4">
                <h2 className="line-clamp-2 font-black">{product.title}</h2>
                <p className="mt-1 line-clamp-3 min-h-12 text-xs leading-4 text-muted-foreground">
                  {product.description || "Materi digital tambahan untuk kelas ini."}
                </p>
                <p className="mt-3 text-lg font-black text-primary">{rupiah(product.price_idr)}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Download className="size-3" /> {product.file_name}
                </p>
                <Button className="mt-4 w-full" disabled>
                  <ShoppingBag className="mr-2 size-4" /> Pembayaran belum aktif
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {!products.isLoading && !products.isError && products.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <PackageOpen className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">Belum ada produk digital</p>
            <p className="mt-1 text-xs text-muted-foreground">Produk guru yang disetujui akan tampil di sini.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
