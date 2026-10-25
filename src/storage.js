export const KEY='orbit-dispatch-v1';
export function emptyRecord(){return {version:1,best:{},events:[],muted:true};}
export function parseRecord(raw) {
  try {
    const v=JSON.parse(raw);
    if(v?.version!==1) return emptyRecord();
    const clean=emptyRecord();clean.muted=v.muted!==false;
    for(const [key,value] of Object.entries(v.best??{})) {
      if(/^[1-6]$/.test(key) && Number.isInteger(value?.moves) && value.moves>=0 && value.moves<=100 && Number.isInteger(value.stars) && value.stars>=1 && value.stars<=3) clean.best[key]={moves:value.moves,stars:value.stars};
    }
    clean.events=Array.isArray(v.events)?v.events.slice(-200).filter(e=>e && ['start','rotate','undo','hint','win','loss','feedback'].includes(e.type) && typeof e.at==='string' && Number.isInteger(e.level) && e.level>=1 && e.level<=6).map(e=>({type:e.type,at:e.at,level:e.level,moves:Number.isInteger(e.moves)?Math.max(0,Math.min(e.moves,100)):0,...(['clear','confusing','again'].includes(e.feedback)?{feedback:e.feedback}:{})})):[];
    return clean;
  } catch { return emptyRecord(); }
}
export function loadRecord(storage) {
  try {return {data:parseRecord(storage.getItem(KEY)),persistent:true};}
  catch {return {data:emptyRecord(),persistent:false};}
}
export function saveRecord(storage,data) {
  try {storage.setItem(KEY,JSON.stringify(data));return true;} catch {return false;}
}
