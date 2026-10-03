import { supabase } from "@/integrations/supabase/client";

// Permukaan PostgREST minimal untuk tabel yang dipilih saat runtime (nama tabel dari peta konfigurasi atau tab).
// Tipe generated tidak dapat dipakai di sini karena nama tabel dan daftar kolom `select` berupa string biasa,
// jadi bentuk query dan hasilnya dinyatakan eksplisit (hasil berupa DbRecord, bukan any).
export type DbRecord = Record<string, unknown>;
type DbResponse<T> = { data: T | null; error: { message: string } | null; count: number | null };
export interface DynamicQuery extends PromiseLike<DbResponse<DbRecord[]>> {
  select(
    columns?: string,
    options?: { count?: "exact" | "planned" | "estimated"; head?: boolean },
  ): DynamicQuery;
  eq(column: string, value: unknown): DynamicQuery;
  neq(column: string, value: unknown): DynamicQuery;
  or(filters: string): DynamicQuery;
  in(column: string, values: readonly unknown[]): DynamicQuery;
  order(column: string, options?: { ascending?: boolean }): DynamicQuery;
  limit(count: number): DynamicQuery;
  range(from: number, to: number): DynamicQuery;
  maybeSingle(): PromiseLike<DbResponse<DbRecord | null>>;
  insert(rows: DbRecord | DbRecord[]): DynamicQuery;
  update(row: DbRecord): DynamicQuery;
  upsert(rows: DbRecord | DbRecord[], options?: { onConflict?: string }): DynamicQuery;
  delete(): DynamicQuery;
}

// `client` boleh klien browser maupun klien admin server; keduanya memiliki from(table).
export function dynamicFrom(client: object, name: string): DynamicQuery {
  return (client as { from(table: string): unknown }).from(name) as DynamicQuery;
}

export function dynamicTable(name: string): DynamicQuery {
  return dynamicFrom(supabase, name);
}
