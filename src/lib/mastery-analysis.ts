export type MasteryReview={item_type:string;item_id?:string|null;rating:number;aspect:string|null;direction?:string|null;used_hint:boolean|null;response_ms:number|null};

export type MasteryWeakness={key:string;itemType:string;aspect:string;label:string;total:number;mastery:number;weaknessScore:number};

const aspectLabels:Record<string,string>={meaning:"Arti",reading:"Bacaan",usage:"Penggunaan",function:"Fungsi",context:"Konteks",confusion:"Membedakan materi mirip",meaning_reading:"Arti & Bacaan",meaning_usage:"Arti & Penggunaan",function_context:"Fungsi & Konteks"};
const materialLabels:Record<string,string>={kanji:"Kanji",vocabulary:"Kotoba",grammar:"Bunpou",reading:"Dokkai",listening:"Choukai"};

export function masteryLabel(itemType:string,aspect:string){return `${materialLabels[itemType]||itemType} · ${aspectLabels[aspect]||aspect}`}

export function analyzeMastery(reviews:MasteryReview[]):MasteryWeakness[]{
  const groups=new Map<string,MasteryReview[]>();
  for(const review of reviews){
    const aspect=review.aspect||review.direction||review.item_type;
    const key=`${review.item_type}:${aspect}`;
    const rows=groups.get(key)??[];
    rows.push(review);
    groups.set(key,rows);
  }
  return [...groups].map(([key,rows])=>{
    const [itemType,aspect]=key.split(":",2);
    const n=Math.max(1,rows.length);
    const correct=rows.filter(row=>row.rating>=2).length/n;
    const hint=rows.filter(row=>row.used_hint).length/n;
    const slow=rows.filter(row=>Number(row.response_ms??0)>8000).length/n;
    const mastery=Math.max(0,Math.min(100,Math.round(correct*100-hint*12-slow*12)));
    const weaknessScore=(1-correct)*.65+hint*.2+slow*.15;
    return{key,itemType,aspect,label:masteryLabel(itemType,aspect),total:rows.length,mastery,weaknessScore};
  }).sort((a,b)=>a.mastery-b.mastery||b.total-a.total);
}

export function weakestMastery(reviews:MasteryReview[]){return analyzeMastery(reviews)[0]??null}
