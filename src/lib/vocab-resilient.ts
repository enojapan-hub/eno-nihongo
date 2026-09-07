import { supabase } from "@/integrations/supabase/client";
import { fetchVocabList, type Level } from "@/lib/learn-queries";

const QUERY_TIMEOUT_MS = 8000;
function withTimeout<T>(promise: PromiseLike<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  return Promise.race([Promise.resolve(promise),new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error("Permintaan database terlalu lama. Silakan coba lagi.")),ms))]);
}

async function fetchLabeledIds(level: Level): Promise<string[]> {
  const res:any = await withTimeout(
    (supabase as any).from("vocabulary_level_labels").select("vocabulary_id").eq("level",level),
  );
  if(res.error) throw new Error(res.error.message);
  return Array.from(new Set((res.data??[]).map((r:any)=>String(r.vocabulary_id)).filter(Boolean)));
}

export async function fetchVocabListResilient(level: Level) {
  // Level profil harus mengikuti vocabulary_level_labels. Field vocabulary.level
  // hanya dipakai sebagai fallback untuk data lama yang belum memiliki label.
  let labeledIds:string[]=[];
  try { labeledIds=await fetchLabeledIds(level); } catch {}

  if(labeledIds.length>0){
    try {
      const extended:any=await withTimeout(
        supabase.from("vocabulary")
          .select("id, term, reading, romaji, meaning_id, meaning_en, part_of_speech, examples, level, sort_order, source_book, lesson_number, lesson_title, vocabulary_senses(meaning_id, part_of_speech, usage_note_id, examples, source_book)")
          .in("id",labeledIds).eq("is_published",true)
          .order("lesson_number",{ascending:true,nullsFirst:false}).order("sort_order",{ascending:true}),
      );
      if(!extended.error){return (extended.data??[]).map((row:any)=>({...row,senses:row.vocabulary_senses??[],curriculum:[],profile_level:level}));}
    } catch {}

    try {
      const basic:any=await withTimeout(
        supabase.from("vocabulary")
          .select("id, term, reading, romaji, meaning_id, meaning_en, part_of_speech, examples, level, sort_order, source_book, lesson_number, lesson_title")
          .in("id",labeledIds).eq("is_published",true)
          .order("lesson_number",{ascending:true,nullsFirst:false}).order("sort_order",{ascending:true}),
      );
      if(!basic.error)return (basic.data??[]).map((row:any)=>({...row,senses:[],curriculum:[],profile_level:level}));
    } catch {}
  }

  // Fallback kompatibilitas: dipakai hanya jika tabel label kosong/tidak dapat dibaca.
  try {
    const extended:any=await withTimeout(
      supabase.from("vocabulary")
        .select("id, term, reading, romaji, meaning_id, meaning_en, part_of_speech, examples, level, sort_order, source_book, lesson_number, lesson_title, vocabulary_senses(meaning_id, part_of_speech, usage_note_id, examples, source_book)")
        .eq("level",level).eq("is_published",true)
        .order("lesson_number",{ascending:true,nullsFirst:false}).order("sort_order",{ascending:true}),
    );
    if(!extended.error&&(extended.data?.length??0)>0)return (extended.data??[]).map((row:any)=>({...row,senses:row.vocabulary_senses??[],curriculum:[],profile_level:level}));
  } catch {}

  try {
    const basic:any=await withTimeout(
      supabase.from("vocabulary")
        .select("id, term, reading, romaji, meaning_id, meaning_en, part_of_speech, examples, level, sort_order, source_book, lesson_number, lesson_title")
        .eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}),
    );
    if(!basic.error&&(basic.data?.length??0)>0)return (basic.data??[]).map((row:any)=>({...row,senses:[],curriculum:[],profile_level:level}));
  } catch {}

  try{return await withTimeout(fetchVocabList(level));}
  catch(error){throw error instanceof Error?error:new Error("Kosakata gagal dimuat dari database.");}
}
