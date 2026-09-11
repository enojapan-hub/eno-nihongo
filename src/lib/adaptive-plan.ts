import { supabase } from "@/integrations/supabase/client";

export type AdaptiveTaskType = "new_kanji" | "new_vocabulary" | "new_grammar" | "review" | "quiz" | "reading" | "listening";
export type AdaptiveSuggestion = { id: string; label: string; subtitle?: string | null };
export type AdaptiveTask = {
  id: string;
  task_type: AdaptiveTaskType;
  target_count: number;
  completed_count: number;
  priority: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  suggestions?: AdaptiveSuggestion[];
};
export type AdaptivePlan = {
  active: boolean;
  targetLevel: string | null;
  targetDate: string | null;
  daysLeft: number | null;
  tasks: AdaptiveTask[];
  target: number;
  completed: number;
};

const emptyPlan: AdaptivePlan = { active: false, targetLevel: null, targetDate: null, daysLeft: null, tasks: [], target: 0, completed: 0 };

async function enrichTasksWithSuggestions(userId:string, level:string, tasks:AdaptiveTask[]):Promise<AdaptiveTask[]> {
  const {data:progress}=await supabase.from("user_item_progress").select("item_type,item_id,status,due_at").eq("user_id",userId).eq("level",level);
  const rows=(progress??[]) as Array<{item_type:string;item_id:string;status:string;due_at:string|null}>;
  const mastered=(type:string)=>new Set(rows.filter(r=>r.item_type===type&&r.status==="mastered").map(r=>r.item_id));
  const known=(type:string)=>new Set(rows.filter(r=>r.item_type===type).map(r=>r.item_id));
  const nowIso=new Date().toISOString();

  return Promise.all(tasks.map(async task=>{
    const wanted=Math.max(1,Math.min(12,Number(task.target_count||1)));
    try{
      if(task.task_type==="new_kanji"){
        const skip=known("kanji");
        const {data}=await supabase.from("kanji").select("id,character,meaning_id").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*4);
        const suggestions=(data??[]).filter(x=>!skip.has(String(x.id))).slice(0,wanted).map(x=>({id:String(x.id),label:String(x.character??"Kanji"),subtitle:x.meaning_id?String(x.meaning_id):null}));
        return {...task,suggestions};
      }
      if(task.task_type==="new_vocabulary"){
        const skip=known("vocabulary");
        const {data}=await supabase.from("vocabulary").select("id,term,reading,meaning_id").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*4);
        const suggestions=(data??[]).filter(x=>!skip.has(String(x.id))).slice(0,wanted).map(x=>({id:String(x.id),label:String(x.term??"Kosakata"),subtitle:[x.reading,x.meaning_id].filter(Boolean).map(String).join(" · ")}));
        return {...task,suggestions};
      }
      if(task.task_type==="new_grammar"){
        const skip=known("grammar");
        const {data}=await supabase.from("grammar_points").select("id,pattern,meaning_id").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*4);
        const suggestions=(data??[]).filter(x=>!skip.has(String(x.id))).slice(0,wanted).map(x=>({id:String(x.id),label:String(x.pattern??"Bunpou"),subtitle:x.meaning_id?String(x.meaning_id):null}));
        return {...task,suggestions};
      }
      if(task.task_type==="reading"){
        const skip=mastered("reading");
        const {data}=await supabase.from("reading_passages").select("id,title").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*3);
        const suggestions=(data??[]).filter(x=>!skip.has(String(x.id))).slice(0,wanted).map(x=>({id:String(x.id),label:String(x.title??"Dokkai")}));
        return {...task,suggestions};
      }
      if(task.task_type==="listening"){
        const skip=mastered("listening");
        const {data}=await supabase.from("listening_items").select("id,title,duration_seconds").eq("level",level).eq("is_published",true).order("sort_order",{ascending:true}).limit(wanted*3);
        const suggestions=(data??[]).filter(x=>!skip.has(String(x.id))).slice(0,wanted).map(x=>({id:String(x.id),label:String(x.title??"Choukai"),subtitle:x.duration_seconds?`${Math.ceil(Number(x.duration_seconds)/60)} menit`:null}));
        return {...task,suggestions};
      }
      if(task.task_type==="review"){
        const due=rows.filter(r=>r.due_at&&r.due_at<=nowIso).slice(0,wanted);
        const suggestions:AdaptiveSuggestion[]=[];
        for(const r of due){
          if(r.item_type==="kanji"){
            const {data}=await supabase.from("kanji").select("character,meaning_id").eq("id",r.item_id).maybeSingle();
            if(data)suggestions.push({id:r.item_id,label:String(data.character??"Kanji"),subtitle:data.meaning_id?String(data.meaning_id):"Review Kanji"});
          } else if(r.item_type==="vocabulary"){
            const {data}=await supabase.from("vocabulary").select("term,meaning_id").eq("id",r.item_id).maybeSingle();
            if(data)suggestions.push({id:r.item_id,label:String(data.term??"Kosakata"),subtitle:data.meaning_id?String(data.meaning_id):"Review Kosakata"});
          } else if(r.item_type==="grammar"){
            const {data}=await supabase.from("grammar_points").select("pattern,meaning_id").eq("id",r.item_id).maybeSingle();
            if(data)suggestions.push({id:r.item_id,label:String(data.pattern??"Bunpou"),subtitle:data.meaning_id?String(data.meaning_id):"Review Bunpou"});
          }
        }
        return {...task,suggestions};
      }
      return task;
    }catch{return task;}
  }));
}

export async function fetchAdaptivePlan(): Promise<AdaptivePlan> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return emptyPlan;

  await supabase.rpc("ensure_active_study_plan", {});
  await supabase.rpc("generate_daily_study_tasks", {});
  await supabase.rpc("sync_daily_study_task_progress", {});

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [{ data: plans }, { data: tasks }] = await Promise.all([
    supabase.from("study_plans").select("id,target_level,target_date,status").eq("user_id", auth.user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1),
    supabase.from("daily_study_tasks").select("id,task_type,target_count,completed_count,priority,reason,metadata").eq("user_id", auth.user.id).eq("study_date", today).order("priority", { ascending: false }),
  ]);

  const plan = plans?.[0];
  if (!plan) return emptyPlan;

  const rawTasks = (tasks ?? []) as AdaptiveTask[];
  const taskRows = await enrichTasksWithSuggestions(auth.user.id,String(plan.target_level??"N5"),rawTasks);
  const target = taskRows.reduce((sum, task) => sum + Number(task.target_count || 0), 0);
  const completed = taskRows.reduce((sum, task) => sum + Math.min(Number(task.completed_count || 0), Number(task.target_count || 0)), 0);
  const targetMs = new Date(`${plan.target_date}T00:00:00+09:00`).getTime();
  const todayMs = new Date(`${today}T00:00:00+09:00`).getTime();
  const daysLeft = Math.max(0, Math.ceil((targetMs - todayMs) / 86400000));

  return {
    active: true,
    targetLevel: plan.target_level ?? null,
    targetDate: plan.target_date ?? null,
    daysLeft,
    tasks: taskRows,
    target,
    completed,
  };
}

export const adaptiveTaskLabels: Record<AdaptiveTaskType, string> = {
  new_kanji: "Kanji baru",
  new_vocabulary: "Kotoba baru",
  new_grammar: "Bunpō baru",
  review: "Review",
  quiz: "Kuis",
  reading: "Dokkai",
  listening: "Listening",
};
