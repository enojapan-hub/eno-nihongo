import { supabase } from "@/integrations/supabase/client";
import { analyzePlannerWeakness, reviewMatchesWeakness, type PlannerReview } from "@/lib/planner-mastery";

export type AdaptiveTaskType = "new_kanji" | "new_vocabulary" | "new_grammar" | "review" | "quiz" | "reading" | "listening";
export type AdaptiveSuggestion = { id: string; label: string; subtitle?: string | null };
export type AdaptiveTask = { id:string; task_type:AdaptiveTaskType; target_count:number; completed_count:number; priority:number; reason:string|null; metadata:Record<string,unknown>|null; suggestions?:AdaptiveSuggestion[] };
export type AdaptivePlan = { active:boolean; targetLevel:string|null; targetDate:string|null; daysLeft:number|null; tasks:AdaptiveTask[]; target:number; completed:number };
const emptyPlan:AdaptivePlan={active:false,targetLevel:null,targetDate:null,daysLeft:null,tasks:[],target:0,completed:0};
type ProgressRow={item_type:string;item_id:string;status:string;due_at:string|null;ease_factor?:number|null};
type ReviewRow=PlannerReview;
const aspectLabel:Record<string,string>={meaning:"Arti",reading:"Bacaan",usage:"Penggunaan",function:"Fungsi",context:"Konteks",confusion:"Membedakan materi mirip",meaning_reading:"Arti & Bacaan",meaning_usage:"Arti & Penggunaan",function_context:"Fungsi & Konteks"};
const materialLabel:Record<string,string>={kanji:"Kanji",vocabulary:"Kotoba",grammar:"Bunpou"};

async function itemSuggestion(client:any,r:{item_type:string;item_id:string},weak=false,weakLabel?:string):Promise<AdaptiveSuggestion|null>{
  const prefix=weak?`Prioritas ${weakLabel||"kelemahan"}`:"Review";
  if(r.item_type==="kanji"){
    const{data}=await client.from("kanji").select("character,meaning_id").eq("id",r.item_id).maybeSingle();
    return data?{id:r.item_id,label:String(data.character??"Kanji"),subtitle:`${prefix} · ${data.meaning_id??"Kanji"}`}:null;
  }
  if(r.item_type==="vocabulary"){
    const{data}=await client.from("vocabulary").select("term,meaning_id").eq("id",r.item_id).maybeSingle();
    return data?{id:r.item_id,label:String(data.term??"Kosakata"),subtitle:`${prefix} · ${data.meaning_id??"Kosakata"}`}:null;
  }
  if(r.item_type==="grammar"){
    const{data}=await client.from("grammar_points").select("pattern,meaning_id").eq("id",r.item_id).maybeSingle();
    return data?{id:r.item_id,label:String(data.pattern??"Bunpou"),subtitle:`${prefix} · ${data.meaning_id??"Bunpou"}`}:null;
  }
  return null;
}

async function enrichTasksWithSuggestions(userId:string,level:string,tasks:AdaptiveTask[]):Promise<AdaptiveTask[]>{
  const client=supabase as any;
  const[{data:progress},{data:reviewData}]=await Promise.all([
    client.from("user_item_progress").select("item_type,item_id,status,due_at,ease_factor").eq("user_id",userId).eq("level",level),
    client.from("flashcard_reviews").select("item_type,item_id,rating,used_hint,response_ms,direction,aspect,created_at").eq("user_id",userId).eq("level",level).order("created_at",{ascending:false}).limit(500)
  ]);
  const rows=(progress??[]) as ProgressRow[];
  const reviews=(reviewData??[]) as ReviewRow[];
  const w=analyzePlannerWeakness(reviews);
  const weakest=w.weakest;
  const weakLabel=weakest?`${materialLabel[weakest.itemType]||weakest.itemType} · ${aspectLabel[weakest.aspect]||weakest.aspect}`:null;
  const nowIso=new Date().toISOString();
  const mastered=(type:string)=>new Set(rows.filter(r=>r.item_type===type&&r.status==="mastered").map(r=>r.item_id));
  const known=(type:string)=>new Set(rows.filter(r=>r.item_type===type).map(r=>r.item_id));
  const aspectItems=new Map<string,number>();
  for(const r of reviews){
    if(!reviewMatchesWeakness(r,weakest))continue;
    const k=`${r.item_type}:${r.item_id}`;
    const penalty=(r.rating<2?.65:0)+(r.used_hint?.2:0)+(Number(r.response_ms??0)>8000?.15:0);
    aspectItems.set(k,(aspectItems.get(k)??0)+penalty);
  }
  return Promise.all(tasks.map(async task=>{
    const wanted=Math.max(1,Math.min(12,Number(task.target_count||1)));
    try{
      if(task.task_type==="review"){
        const due=rows.filter(r=>r.due_at&&r.due_at<=nowIso).map(r=>({...r,score:3+(w.item.get(`${r.item_type}:${r.item_id}`)??0)+(aspectItems.get(`${r.item_type}:${r.item_id}`)??0)}));
        const weakNotDue=rows.filter(r=>!(r.due_at&&r.due_at<=nowIso)).map(r=>({...r,score:(w.item.get(`${r.item_type}:${r.item_id}`)??0)+(aspectItems.get(`${r.item_type}:${r.item_id}`)??0)})).filter(r=>r.score>=.28);
        const queue=[...due.sort((a,b)=>b.score-a.score),...weakNotDue.sort((a,b)=>b.score-a.score)].slice(0,wanted);
        const suggestions=(await Promise.all(queue.map(r=>itemSuggestion(client,r,r.score<3,weakLabel??undefined)))).filter(Boolean) as AdaptiveSuggestion[];
        return{...task,priority:queue.length?120:task.priority,target_count:Math.max(task.target_count,Math.min(12,queue.length)),reason:queue.length?`Review jatuh tempo diprioritaskan, lalu kelemahan ${weakLabel??"recall"}, sebelum materi baru.`:task.reason,suggestions,metadata:{...(task.metadata??{}),smartReview:true,weakCount:weakNotDue.length,dueCount:due.length,weakestItemType:weakest?.itemType??null,weakestAspect:weakest?.aspect??null,weakestAspectLabel:weakLabel,weakestAspectScore:weakest?Math.round((1-weakest.mastery)*100):null}};
      }
      const weaknessScore=weakest?1-weakest.mastery:0;
      const newPenalty=weakest&&weaknessScore>=.35?25:0;
      const adjusted={...task,priority:Math.max(1,task.priority-newPenalty),metadata:{...(task.metadata??{}),weaknessGuard:newPenalty>0,weakestItemType:weakest?.itemType??null,weakestAspect:weakest?.aspect??null}};
      if(task.task_type==="new_kanji"){
        const skip=known("kanji");
        const{data}=await client.from("kanji").select("id,character,meaning_id").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*4);
        return{...adjusted,suggestions:(data??[]).filter((x:any)=>!skip.has(String(x.id))).slice(0,wanted).map((x:any)=>({id:String(x.id),label:String(x.character??"Kanji"),subtitle:x.meaning_id?String(x.meaning_id):null}))};
      }
      if(task.task_type==="new_vocabulary"){
        const skip=known("vocabulary");
        const{data}=await client.from("vocabulary").select("id,term,reading,meaning_id").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*4);
        return{...adjusted,suggestions:(data??[]).filter((x:any)=>!skip.has(String(x.id))).slice(0,wanted).map((x:any)=>({id:String(x.id),label:String(x.term??"Kosakata"),subtitle:[x.reading,x.meaning_id].filter(Boolean).map(String).join(" · ")}))};
      }
      if(task.task_type==="new_grammar"){
        const skip=known("grammar");
        const{data}=await client.from("grammar_points").select("id,pattern,meaning_id").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*4);
        return{...adjusted,suggestions:(data??[]).filter((x:any)=>!skip.has(String(x.id))).slice(0,wanted).map((x:any)=>({id:String(x.id),label:String(x.pattern??"Bunpou"),subtitle:x.meaning_id?String(x.meaning_id):null}))};
      }
      if(task.task_type==="reading"){
        const skip=mastered("reading");
        const{data}=await client.from("reading_passages").select("id,title").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*3);
        return{...adjusted,suggestions:(data??[]).filter((x:any)=>!skip.has(String(x.id))).slice(0,wanted).map((x:any)=>({id:String(x.id),label:String(x.title??"Dokkai")}))};
      }
      if(task.task_type==="listening"){
        const skip=mastered("listening");
        const{data}=await client.from("listening_items").select("id,title,duration_seconds").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*3);
        return{...adjusted,suggestions:(data??[]).filter((x:any)=>!skip.has(String(x.id))).slice(0,wanted).map((x:any)=>({id:String(x.id),label:String(x.title??"Choukai"),subtitle:x.duration_seconds?`${Math.ceil(Number(x.duration_seconds)/60)} menit`:null}))};
      }
      return adjusted;
    }catch{return task}
  }));
}

export async function fetchAdaptivePlan():Promise<AdaptivePlan>{
  const{data:auth,error:authError}=await supabase.auth.getUser();
  if(authError||!auth.user)return emptyPlan;
  const client=supabase as any;
  await client.rpc("ensure_active_study_plan",{});
  await client.rpc("generate_daily_study_tasks",{});
  await client.rpc("sync_daily_study_task_progress",{});
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const[{data:plans},{data:tasks}]=await Promise.all([
    client.from("study_plans").select("id,target_level,target_date,status").eq("user_id",auth.user.id).eq("status","active").order("created_at",{ascending:false}).limit(1),
    client.from("daily_study_tasks").select("id,task_type,target_count,completed_count,priority,reason,metadata").eq("user_id",auth.user.id).eq("study_date",today).order("priority",{ascending:false})
  ]);
  const plan=plans?.[0];
  if(!plan)return emptyPlan;
  const taskRows=[...(await enrichTasksWithSuggestions(auth.user.id,String(plan.target_level??"N5"),(tasks??[]) as AdaptiveTask[]))].sort((a,b)=>b.priority-a.priority);
  const target=taskRows.reduce((s,t)=>s+Number(t.target_count||0),0);
  const completed=taskRows.reduce((s,t)=>s+Math.min(Number(t.completed_count||0),Number(t.target_count||0)),0);
  const targetMs=new Date(`${plan.target_date}T00:00:00+09:00`).getTime();
  const todayMs=new Date(`${today}T00:00:00+09:00`).getTime();
  const daysLeft=Math.max(0,Math.ceil((targetMs-todayMs)/86400000));
  return{active:true,targetLevel:plan.target_level??null,targetDate:plan.target_date??null,daysLeft,tasks:taskRows,target,completed};
}

export const adaptiveTaskLabels:Record<AdaptiveTaskType,string>={new_kanji:"Kanji baru",new_vocabulary:"Kotoba baru",new_grammar:"Bunpō baru",review:"Review",quiz:"Kuis",reading:"Dokkai",listening:"Listening"};
