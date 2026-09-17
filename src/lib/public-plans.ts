export type PublicPlan = {
  code: "premium_monthly" | "premium_yearly" | "lifetime";
  name: string;
  price: number;
  billing: string;
  description: string;
  featured?: boolean;
};

export const PUBLIC_PLANS: PublicPlan[] = [
  {
    code: "premium_monthly",
    name: "Premium Bulanan",
    price: 50_000,
    billing: "per bulan",
    description: "Akses fitur Premium dan ENO Exam Bulanan selama 30 hari.",
  },
  {
    code: "premium_yearly",
    name: "Premium Tahunan",
    price: 350_000,
    billing: "per tahun",
    description: "Akses fitur Premium dan ENO Exam Bulanan selama 365 hari.",
    featured: true,
  },
  {
    code: "lifetime",
    name: "Lifetime",
    price: 1_500_000,
    billing: "sekali bayar",
    description: "Akses Premium selamanya, tanpa perpanjangan langganan.",
  },
];

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
