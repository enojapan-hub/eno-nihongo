import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const settingsSchema = z.object({
  display_name: z.string().trim().min(2).max(60),
  target_level: z.enum(["N5", "N4", "N3", "N2", "N1"]),
  ui_language: z.enum(["id", "en", "ja"]),
  country: z.string().trim().min(2).max(80).optional(),
  daily_kanji_target: z.number().int().min(0).max(100),
  daily_vocab_target: z.number().int().min(0).max(200),
  daily_grammar_target: z.number().int().min(0).max(100),
  furigana_enabled: z.boolean(),
  daily_reminder: z.boolean(),
});

export type ProfileSettingsInput = z.infer<typeof settingsSchema>;

const DEFAULT_SETTINGS = {
  daily_kanji_target: 5,
  daily_vocab_target: 10,
  daily_grammar_target: 5,
  furigana_enabled: true,
  daily_reminder: false,
};

type SupabaseError = { message: string } | null;
type QueryResult<T> = { data: T | null; error: SupabaseError };
type QueryBuilder<T> = {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: string) => QueryBuilder<T>;
  maybeSingle: () => Promise<QueryResult<T>>;
  update: (values: Record<string, unknown>) => QueryBuilder<T>;
  upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => Promise<QueryResult<unknown>>;
};
type SupabaseLike = {
  from: <T = Record<string, unknown>>(table: string) => QueryBuilder<T>;
};
type AuthContext = { supabase: SupabaseLike; userId: string };

type ProfileRow = {
  role?: string | null;
  [key: string]: unknown;
};
type SettingsRow = Partial<typeof DEFAULT_SETTINGS>;

async function readMemberData(context: AuthContext) {
  const [{ data: profile, error: profileError }, { data: settings, error: settingsError }] =
    await Promise.all([
      context.supabase
        .from<ProfileRow>("profiles")
        .select(
          "id,display_name,avatar_url,ui_language,target_level,country,onboarding_completed,plan,premium_until,created_at,role",
        )
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from<SettingsRow>("user_settings")
        .select(
          "daily_kanji_target,daily_vocab_target,daily_grammar_target,furigana_enabled,daily_reminder",
        )
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

  if (profileError) throw new Error(profileError.message);
  if (settingsError) throw new Error(settingsError.message);
  return { profile, settings: settings ?? DEFAULT_SETTINGS };
}

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { profile, settings } = await readMemberData(context as AuthContext);
    if (!profile) throw new Error("Profil akun belum tersedia.");
    return { profile, settings, roles: profile.role ? [profile.role] : ["student"] };
  });

export const updateMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ context, data }) => {
    const authContext = context as AuthContext;
    const { profile } = await readMemberData(authContext);
    if (!profile) throw new Error("Profil akun belum tersedia.");

    const update: Record<string, unknown> = {
      display_name: data.display_name,
      target_level: data.target_level,
      ui_language: data.ui_language,
    };
    if (data.country) {
      update.country = data.country;
      update.onboarding_completed = true;
    }

    const { error: profileError } = await authContext.supabase
      .from("profiles")
      .update(update)
      .eq("id", authContext.userId)
      .maybeSingle();
    if (profileError) throw new Error(`Profil gagal disimpan: ${profileError.message}`);

    const { error: settingsError } = await authContext.supabase
      .from("user_settings")
      .upsert(
        {
          user_id: authContext.userId,
          daily_kanji_target: data.daily_kanji_target,
          daily_vocab_target: data.daily_vocab_target,
          daily_grammar_target: data.daily_grammar_target,
          furigana_enabled: data.furigana_enabled,
          daily_reminder: data.daily_reminder,
        },
        { onConflict: "user_id" },
      );
    if (settingsError)
      throw new Error(`Pengaturan gagal disimpan: ${settingsError.message}`);

    return { ok: true };
  });
