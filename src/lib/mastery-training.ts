export type MasteryTrainingTarget={itemType:string;aspect:string};

const validItemTypes=new Set(["kanji","vocabulary","grammar"]);
const validAspects=new Set(["meaning","reading","usage","function","context","confusion"]);

export function masteryTrainingHref(target:MasteryTrainingTarget){
  const params=new URLSearchParams();
  if(validItemTypes.has(target.itemType))params.set("kind",target.itemType);
  if(validAspects.has(target.aspect))params.set("aspect",target.aspect);
  params.set("mode","weak");
  return `/hafalan?${params.toString()}`;
}

export function parseMasteryTraining(search:string):MasteryTrainingTarget|null{
  const params=new URLSearchParams(search);
  const itemType=params.get("kind")??"";
  const aspect=params.get("aspect")??"";
  if(!validItemTypes.has(itemType)||!validAspects.has(aspect))return null;
  return{itemType,aspect};
}
