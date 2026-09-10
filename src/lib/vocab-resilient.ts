import { supabase } from "@/integrations/supabase/client";
import type { Level } from "@/lib/learn-queries";

const QUERY_TIMEOUT_MS=8000;
export const VOCAB_PAGE_SIZE=60;
function withTimeout<T>(promise:PromiseLike<T>,ms=QUERY_TIMEOUT_MS):Promise<T>{return Promise.race([Promise.resolve(promise),new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error("Permintaan database terlalu lama. Silakan coba lagi.")),ms))]);}

export async function fetchVocabCount(level:Level):Promise<number>{
 const res:any=await withTimeout((supabase as any).rpc("get_vocabulary_count_by_level",{p_level:level}));
 if(res.error)throw new Error(res.error.message);
 return Number(res.data??0);
}

export async function fetchVocabPage(level:Level,offset=0,limit=VOCAB_PAGE_SIZE){
 const res:any=await withTimeout((supabase as any).rpc("get_vocabulary_page_by_level",{p_level:level,p_offset:offset,p_limit:limit}));
 if(res.error)throw new Error(res.error.message);
 return (res.data??[]).map((row:any)=>({...row,senses:[],curriculum:[],profile_level:level}));
}

export async function fetchVocabSenses(vocabularyId:string){
 const res:any=await withTimeout(supabase.from("vocabulary_senses").select("meaning_id, part_of_speech, usage_note_id, examples, source_book").eq("vocabulary_id",vocabularyId));
 if(res.error)throw new Error(res.error.message);
 return res.data??[];
}

// Kompatibilitas untuk pemanggil lama: memuat bertahap agar tidak mengirim ribuan ID dalam satu query.
export async function fetchVocabListResilient(level:Level){
 const total=await fetchVocabCount(level),rows:any[]=[];
 for(let offset=0;offset<total;offset+=200)rows.push(...await fetchVocabPage(level,offset,200));
 return rows;
}
