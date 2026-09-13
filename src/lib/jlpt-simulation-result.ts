import type { Level } from "@/lib/learn-queries";

type SectionResult={total_questions:number;correct_count:number;score_percent:number};
export type FullProgress={sessionIndex:number;sectionIndex:number;startedAt:number;completed:string[];results?:Record<string,SectionResult>};
export type ScoreBlock={id:string;label:string;score:number;max:number;passMark:number};

const overallPass:Record<Level,number>={N1:100,N2:90,N3:95,N4:90,N5:80};

const ratio=(results:SectionResult[])=>{const total=results.reduce((n,r)=>n+r.total_questions,0);const correct=results.reduce((n,r)=>n+r.correct_count,0);return total?correct/total:0};
const scale=(value:number,max:number)=>Math.max(0,Math.min(max,Math.round(value*max)));

export function getCefrReference(level:Level,total:number,passed:boolean):string|null{
 if(!passed)return null;
 if(level==="N5")return "A1";
 if(level==="N4")return "A2";
 if(level==="N3")return total>=104?"B1":"A2";
 if(level==="N2")return total>=112?"B2":"B1";
 return total>=142?"C1":"B2";
}

export function buildPracticeResult(level:Level,progress:FullProgress){
 const values=Object.values(progress.results??{});
 const bySection=(name:string)=>Object.entries(progress.results??{}).filter(([k])=>k.endsWith(`:${name}`)).map(([,v])=>v);
 let blocks:ScoreBlock[]=[];
 if(level==="N1"||level==="N2"||level==="N3"){
  blocks=[
   {id:"language",label:"言語知識（文字・語彙・文法）",score:scale(ratio([...bySection("vocabulary"),...bySection("grammar")]),60),max:60,passMark:19},
   {id:"reading",label:"読解",score:scale(ratio(bySection("reading")),60),max:60,passMark:19},
   {id:"listening",label:"聴解",score:scale(ratio(bySection("listening")),60),max:60,passMark:19},
  ];
 }else{
  const language=[...bySection("vocabulary"),...bySection("grammar"),...bySection("reading")];
  blocks=[
   {id:"language-reading",label:"言語知識（文字・語彙・文法）・読解",score:scale(ratio(language),120),max:120,passMark:38},
   {id:"listening",label:"聴解",score:scale(ratio(bySection("listening")),60),max:60,passMark:19},
  ];
 }
 const total=blocks.reduce((n,b)=>n+b.score,0);
 const sectionPass=blocks.every(b=>b.score>=b.passMark);
 const passed=total>=overallPass[level]&&sectionPass;
 const cefr=getCefrReference(level,total,passed);
 return {blocks,total,max:180,passed,cefr,overallPass:overallPass[level],rawQuestions:values.reduce((n,r)=>n+r.total_questions,0),rawCorrect:values.reduce((n,r)=>n+r.correct_count,0)};
}
