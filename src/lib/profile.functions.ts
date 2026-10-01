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
const DEFAULT_SETTINGS={daily_kanji_target:5,daily_vocab_target:10,daily_grammar_target:5,furigana_enabled:true,daily_reminder:false};

async function readMemberData(context:{supabase:any;userId:string}){
 const [{data:profile,error:profileError},{data:settings,error:settingsError}]=await Promise.all([
  context.supabase.from("profiles").select("id,display_name,avatar_url,ui_language,target_level,country,onboarding_completed,plan,premium_until,created_at,role").eq("id",context.userId).maybeSingle(),
  context.supabase.from("user_settings").select("daily_kanji_target,daily_vocab_target,daily_grammar_target,furigana_enabled,daily_reminder").eq("user_id",context.userId).maybeSingle(),
 ]);
 if(profileError)throw new Error(profileError.message); if(settingsError)throw new Error(settingsError.message); return{profile,settings:settings??DEFAULT_SETTINGS};
}
export const getMyAccount=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const{profile,settings}=await readMemberData(context);if(!profile)throw new Error("Profil akun belum tersedia.");return{profile,settings,roles:profile.role?[profile.role]:["student"]}});
export const updateMyAccount=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:unknown)=>settingsSchema.parse(data)).handler(async({context,data})=>{
 const{profile}=await readMemberData(context);if(!profile)throw new Error("Profil akun belum tersedia.");
 const update:any={display_name:data.display_name,target_level:data.target_level,ui_language:data.ui_language};
 if(data.country){update.country=data.country;update.onboarding_completed=true;}
 const{error:profileError}=await context.supabase.from("profiles").update(update).eq("id",context.userId);if(profileError)throw new Error(`Profil gagal disimpan: ${profileError.message}`);
 const{error:settingsError}=await context.supabase.from("user_settings").upsert({user_id:context.userId,daily_kanji_target:data.daily_kanji_target,daily_vocab_target:data.daily_vocab_target,daily_grammar_target:data.daily_grammar_target,furigana_enabled:data.furigana_enabled,daily_reminder:data.daily_reminder},{onConflict:"user_id"});if(settingsError)throw new Error(`Pengaturan gagal disimpan: ${settingsError.message}`);return{ok:true};
});
