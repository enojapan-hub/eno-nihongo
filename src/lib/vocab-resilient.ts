import { supabase } from "@/integrations/supabase/client";
import { fetchVocabList, type Level } from "@/lib/learn-queries";

const QUERY_TIMEOUT_MS = 8000;
const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 500;
function withTimeout<T>(promise: PromiseLike<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  return Promise.race([Promise.resolve(promise),new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error("Permintaan database terlalu lama. Silakan coba lagi.")),ms))]);
}

async function fetchLabeledIds(level: Level): Promise<string[]> {
  const ids:string[]=[];
  for(let from=0;;from+=PAGE_SIZE){
    const res:any = await withTimeout(
      (supabase as any).from("vocabulary_level_labels").select("vocabulary_id").eq("level",level).range(from,from+PAGE_SIZE-1),
    );
    if(res.error) throw new Error(res.error.message);
    const rows=res.data??[];
    ids.push(...rows.map((r:any)=>String(r.vocabulary_id)).filter(Boolean));
    if(rows.length<PAGE_SIZE)break;
  }
  return Array.from(new Set(ids));
}

async function fetchByLabeledIds(labeledIds:string[],extended:boolean){
  const rows:any[]=[];
  for(let start=0;start<labeledIds.length;start+=ID_CHUNK_SIZE){
    const ids=labeledIds.slice(start,start+ID_CHUNK_SIZE);
    const selection=extended
      ? "id, term, reading, romaji, meaning_id, meaning_en, part_of_speech, examples, level, sort_order, source_book, lesson_number, lesson_title, vocabulary_senses(meaning_id, part_of_speech, usage_note_id, examples, source_book)"
      : "id, term, reading, romaji, meaning_id, meaning_en, part_of_speech, examples, level, sort_order, source_book, lesson_number, lesson_title";
    const res:any=await withTimeout(
      supabase.from("vocabulary").select(selection).in("id",ids).eq("is_published",true),
    );
    if(res.error)throw new Error(res.error.message);
    rows.push(...(res.data??[]));
  }
  rows.sort((a,b)=>{
    const la=a.lesson_number??Number.MAX_SAFE_INTEGER,lb=b.lesson_number??Number.MAX_SAFE_INTEGER;
    if(la!==lb)return la-lb;
    const sa=a.sort_order??Number.MAX_SAFE_INTEGER,sb=b.sort_order??Number.MAX_SAFE_INTEGER;
    return sa-sb;
  });
  return rows;
}

export async function fetchVocabListResilient(level: Level) {
  // Level profil harus mengikuti vocabulary_level_labels. Field vocabulary.level
  // hanya dipakai sebagai fallback untuk data lama yang belum memiliki label.
  // Query dipaginasi agar jumlah di UI tidak berhenti pada batas default Supabase 1.000 baris.
  let labeledIds:string[]=[];
  try { labeledIds=await fetchLabeledIds(level); } catch {}

  if(labeledIds.length>0){
    try {
      const extended=await fetchByLabeledIds(labeledIds,true);
      return extended.map((row:any)=>({...row,senses:row.vocabulary_senses??[],curriculum:[],profile_level:level}));
    } catch {}

    try {
      const basic=await fetchByLabeledIds(labeledIds,false);
      return basic.map((row:any)=>({...row,senses:[],curriculum:[],profile_level:level}));
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
