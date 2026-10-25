import {createLevel,LEVEL_COUNT} from './levels.js';
import {initialState,turn,undo,hint,connected,stars} from './rules.js';
import {loadRecord,saveRecord,emptyRecord} from './storage.js';

const $=id=>document.getElementById(id);
let storage;
try{storage=window.localStorage;}catch{storage=null;}
let {data:record,persistent}=loadRecord(storage);
const requested=Number(new URLSearchParams(location.search).get('level'));
let index=Number.isInteger(requested)&&requested>=1&&requested<=LEVEL_COUNT?requested-1:0;
let state=initialState(createLevel(index)),started=false,hinted=null,audio=null;
const names=['北','东','南','西'];
function log(type,extra={}){
  record.events.push({type,level:state.level.id,moves:state.moves,at:new Date().toISOString(),...extra});
  record.events=record.events.slice(-200);persist();
}
function persist(){persistent=saveRecord(storage,record);}
function playTone(win=false){
  if(record.muted)return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    audio??=new AC();audio.resume().catch(()=>{});
    const notes=win?[440,554.37,659.25]:[240+state.moves*12];
    notes.forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.12;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.23);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.25);});
  }catch{/* Audio is optional; the visual feedback remains authoritative. */}
}
function selectLevel(next){
  index=next;state=initialState(createLevel(index));started=true;hinted=null;
  const url=new URL(location.href);url.searchParams.set('level',String(index+1));history.replaceState(null,'',url);
  log('start');render();$('board').querySelector('[data-cell="11"]')?.focus({preventScroll:true});
}
function paths(mask){
  return [[1,'M50 50V0'],[2,'M50 50H100'],[4,'M50 50V100'],[8,'M50 50H0']].filter(([bit])=>mask&bit).map(([,path])=>path).join(' ');
}
function render(){
  const lit=connected(state.level,state.cells),relays=state.cells.filter(c=>c.relay),won=state.status==='won';
  $('sector').textContent=`SECTOR ${String(index+1).padStart(2,'0')} / 06`;
  $('level-title').textContent=state.level.name;
  $('remaining').textContent=String(state.level.budget-state.moves).padStart(2,'0');
  $('relay-count').textContent=`${relays.filter(c=>lit.has(c.id)).length} / ${relays.length}`;
  $('par').textContent=`≤ ${state.level.par} 步`;
  $('phase').textContent=!started?'等待接入':won?'通联成功':state.status==='lost'?'调度耗尽':'信号接入中';
  $('phase').classList.toggle('online',started&&state.status!=='lost');
  $('welcome').hidden=started;
  $('result').hidden=!started||state.status==='playing';
  const active=started&&state.status==='playing';
  $('undo').disabled=!started||!state.history.length||won;
  $('hint').disabled=!active;$('restart').disabled=!started;
  // Reuse focused cells: keyboard interaction must not lose its target on each render.
  const oldFocus=document.activeElement?.dataset.cell;
  $('board').innerHTML=state.cells.map(c=>{
    const fixed=c.fixed,source=c.id===state.level.source,target=c.id===state.level.target;
    const dir=[1,2,4,8].map((b,i)=>c.mask&b?names[i]:'').filter(Boolean).join('、');
    const label=`${Math.floor(c.id/5)+1} 行 ${c.id%5+1} 列，${source?'能源，固定':target?'星港，固定':c.relay?'中继站':'线路'}，开口${dir}，${lit.has(c.id)?'已通电':'未通电'}`;
    return `<button class="cell${lit.has(c.id)?' lit':''}${fixed?' fixed':''}${source?' source':''}${target?' target':''}${hinted===c.id?' hinted':''}" data-cell="${c.id}" aria-label="${label}" ${!active?'disabled':''} aria-disabled="${fixed||!active}"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="rail" d="${paths(c.mask)}"/><path class="signal" d="${paths(c.mask)}"/><circle class="dot" cx="50" cy="50" r="7"/></svg>${source?'<span class="badge">✦</span>':target?'<span class="badge">▣</span>':c.relay?'<span class="badge">◇</span>':''}</button>`;
  }).join('');
  if(oldFocus!==undefined&&active)$('board').querySelector(`[data-cell="${oldFocus}"]`)?.focus({preventScroll:true});
  $('levels').innerHTML=Array.from({length:LEVEL_COUNT},(_,i)=>`<button class="level-button${index===i?' active':''}${record.best[i+1]?' done':''}" data-level="${i}" aria-label="第 ${i+1} 关${record.best[i+1]?`，已获 ${record.best[i+1].stars} 星`:''}" ${index===i?'aria-current="step"':''}>${String(i+1).padStart(2,'0')}</button>`).join('');
  $('total-stars').textContent=`${Object.values(record.best).reduce((s,b)=>s+b.stars,0)} / 18 ✦`;
  $('sound').textContent=`声音：${record.muted?'关':'开'}`;
  const storageNote=persistent?'':' · 浏览器未允许保存，记录仅在本次打开时保留。';
  $('message').textContent=(!started?'准备好后，开始你的第一段航程。':won?'星港已收到能源。下一段航程，等你接通。':state.status==='lost'?'次数用尽了。撤销一步重新规划，或重新开始本关。':hinted!==null?'金色边框的线路值得调整，点击它旋转。使用提示后本次最多一星。':state.level.tip)+storageNote;
  if(started&&state.status!=='playing'){
    $('result-label').textContent=won?'SIGNAL RECEIVED / 通联完成':'SIGNAL LOST / 请重新规划';
    $('result-stars').textContent=won?'✦'.repeat(stars(state))+'☆'.repeat(3-stars(state)):'◎';
    $('result-title').textContent=won?(index===5?'最后的星港，也亮起来了。':'远方，收到你的光了。'):'航线还差一点。';
    $('result-copy').textContent=won?`${state.moves} 次调度 · ${state.hints?'使用过提示 · ':''}所有中继站已接通。`:'没有时间惩罚。换一个思路，再试一次。';
    $('next').textContent=won?(index===5?'回到第一段航程 →':'前往下一段航程 →'):'撤销一步，继续规划 ↶';
  }
}
function rotateCell(id){
  if(!started)return;
  const next=turn(state,id);if(next===state)return;
  state=next;hinted=null;log('rotate');
  if(state.status==='won'){
    const count=stars(state),old=record.best[state.level.id];
    if(!old||count>old.stars||(count===old.stars&&state.moves<old.moves))record.best[state.level.id]={moves:state.moves,stars:count};
    log('win');playTone(true);
  }else if(state.status==='lost'){log('loss');}else playTone();
  render();
  if(state.status!=='playing')$('next').focus({preventScroll:true});
}
function undoMove(){const next=undo(state);if(next===state)return;state=next;hinted=null;log('undo');render();}
function showHint(){if(!started||state.status!=='playing')return;hinted=hint(state);if(hinted!==null){state={...state,hints:state.hints+1};log('hint');render();}}
$('start').addEventListener('click',()=>selectLevel(index));
$('levels').addEventListener('click',e=>{const b=e.target.closest('[data-level]');if(b)selectLevel(Number(b.dataset.level));});
$('board').addEventListener('click',e=>{const b=e.target.closest('[data-cell]');if(b)rotateCell(Number(b.dataset.cell));});
$('board').addEventListener('keydown',e=>{
  const b=e.target.closest('[data-cell]');if(!b)return;
  const delta={ArrowUp:-5,ArrowDown:5,ArrowLeft:-1,ArrowRight:1}[e.key];
  if(delta===undefined)return;e.preventDefault();
  const id=Number(b.dataset.cell),next=id+delta;
  if(next<0||next>=25||(Math.abs(delta)===1&&Math.floor(id/5)!==Math.floor(next/5)))return;
  $('board').querySelector(`[data-cell="${next}"]`).focus();
});
$('undo').addEventListener('click',undoMove);$('hint').addEventListener('click',showHint);
$('restart').addEventListener('click',()=>selectLevel(index));
$('result-retry').addEventListener('click',()=>selectLevel(index));
$('next').addEventListener('click',()=>state.status==='lost'?undoMove():selectLevel((index+1)%LEVEL_COUNT));
$('help').addEventListener('click',()=>$('help-dialog').showModal());
$('feedback').addEventListener('click',()=>$('feedback-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('sound').addEventListener('click',()=>{record.muted=!record.muted;persist();playTone();render();});
document.addEventListener('keydown',e=>{
  if(e.target.closest('dialog,input,textarea,select')||document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey||!started)return;
  if(e.key.toLowerCase()==='u'){e.preventDefault();undoMove();}
  if(e.key.toLowerCase()==='h'){e.preventDefault();showHint();}
  if(e.key.toLowerCase()==='r'){e.preventDefault();selectLevel(index);}
});
$('share').addEventListener('click',async()=>{
  const url=new URL(location.href);url.searchParams.set('level',String(index+1));
  try{
    if(navigator.share){await navigator.share({title:'星港调度 · Orbit Dispatch',text:`来接通第 ${index+1} 段航线。`,url:url.href});$('message').textContent='航程已交给系统分享。';}
    else{await navigator.clipboard.writeText(url.href);$('message').textContent='本关链接已复制，可以发给朋友一起挑战。';}
  }catch(e){if(e.name!=='AbortError')$('message').textContent=`可复制浏览器地址分享本关：${url.href}`;}
});
document.querySelectorAll('[data-feeling]').forEach(b=>b.addEventListener('click',()=>{log('feedback',{feedback:b.dataset.feeling});$('feedback-status').textContent='已保存在本机，可导出交给开发者。';}));
$('export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({game:'orbit-dispatch',version:1,exportedAt:new Date().toISOString(),best:record.best,events:record.events},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='orbit-dispatch-playtest.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('clear').addEventListener('click',()=>{
  if(!confirm('清除本机所有星级、进度与试玩记录？此操作无法撤销。'))return;
  record=emptyRecord();persist();$('feedback-status').textContent='本机进度与记录已清除。';render();
});
render();
