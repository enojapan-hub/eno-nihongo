import { analyzeMastery, type MasteryReview } from "@/lib/mastery-analysis";

export type PlannerReview=MasteryReview&{created_at?:string|null;direction?:string|null};

export type PlannerWeakness={
  item:Map<string,number>;
  groups:ReturnType<typeof analyzeMastery>;
  weakest:ReturnType<typeof analyzeMastery>[number]|null;
};

export function analyzePlannerWeakness(reviews:PlannerReview[]):PlannerWeakness{
  const byItem=new Map<string,PlannerReview[]>();
  for(const review of reviews){
    const key=`${review.item_type}:${review.item_id??""}`;
    const rows=byItem.get(key)??[];
    rows.push(review);
    byItem.set(key,rows);
  }
  const item=new Map<string,number>();
  for(const[key,all]of byItem){
    const rows=all.slice(0,8),n=Math.max(1,rows.length);
    const wrong=rows.filter(row=>row.rating<2).length/n;
    const hint=rows.filter(row=>row.used_hint).length/n;
    const slow=rows.filter(row=>Number(row.response_ms??0)>8000).length/n;
    item.set(key,wrong*.67+hint*.18+slow*.15);
  }
  const groups=analyzeMastery(reviews);
  return{item,groups,weakest:groups[0]??null};
}

export function reviewMatchesWeakness(review:PlannerReview,weakest:PlannerWeakness["weakest"]){
  if(!weakest)return false;
  const aspect=review.aspect||review.direction||review.item_type;
  return review.item_type===weakest.itemType&&aspect===weakest.aspect;
}
