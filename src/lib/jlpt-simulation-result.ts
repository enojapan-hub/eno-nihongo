import type { Level } from "@/lib/learn-queries";

type SectionResult={total_questions:number;correct_count:number;score_percent:number};
export type FullProgress={sessionIndex:number;sectionIndex:number;startedAt:number;completed:string[];results?:Record<string,SectionResult>};
export type ScoreBlock={id:string;label:string;score:number;max:number};

const overallPass:Record<Level,number>={N1:100,N2:90,N3:95,N4:90,N5:80};
const sectionFloor:Record<Level,number>={N1:19,N2:19,N3:19,N4:38,N5:38};

const pct=(results:SectionResult[],ids:string[])=>{const picked=ids.map(id=>results[Number(id)]).filter(Boolean);const total=picked.reduce((n,r)=>n+r.total_questions,0);const correct=picked.reduce((n,r)=>n+r.correct_count,0);return total?correct/total:0};
const scale=(ratio:number,max:number)=>Math.max(0,Math.min(max,Math.round(ratio*max)));

export function buildPracticeResult(level:Level,progress:FullProgress){
 const values=Object.values(progress.results??{});
 const bySection=(name:string)=>Object.entries(progress.results??{}).filter(([k])=>k.endsWith(`:${name}`)).map(([,v])=>v);
 let blocks:ScoreBlock[]=[];
 if(level==="N1"||level==="N2"||level==="N3"){
  blocks=[
   {id:"language",label:"言語知識（文字・語彙・文法）",score:scale(pct([...bySection("vocabulary"),...bySection("grammar")], [...Array(bySection("vocabulary").length+bySection("grammar").length).keys()].map(String)),60),max:60},
   {id:"reading",label:"読解",score:scale(pct(bySection("reading"),bySection("reading").map((_,i)=>String(i))),60),max:60},
   {id:"listening",label:"聴解",score:scale(pct(bySection("listening"),bySection("listening").map((_,i)=>String(i))),60),max:60},
  ];
 }else{
  const language=[...bySection("vocabulary"),...bySection("grammar"),...bySection("reading")];
  blocks=[
   {id:"language-reading",label:"言語知識（文字・語彙・文法）・読解",score:scale(pct(language,language.map((_,i)=>String(i))),120),max:120},
   {id:"listening",label:"聴解",score:scale(pct(bySection("listening"),bySection("listening").map((_,i)=>String(i))),60),max:60},
  ];
 }
 const total=blocks.reduce((n,b)=>n+b.score,0);const floor=sectionFloor[level];const sectionPass=blocks.every(b=>b.score>=floor);const passed=total>=overallPass[level]&&sectionPass;
 return {blocks,total,max:180,passed,overallPass:overallPass[level],sectionFloor:floor,rawQuestions:values.reduce((n,r)=>n+r.total_questions,0),rawCorrect:values.reduce((n,r)=>n+r.correct_count,0)};
}
