import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLevel,LEVEL_COUNT,rotateMask,clockwiseDistance} from '../src/levels.js';
import {initialState,turn,undo,hint,connected,stars,outcome} from '../src/rules.js';
import {parseRecord,loadRecord,saveRecord,emptyRecord} from '../src/storage.js';

for(let i=0;i<LEVEL_COUNT;i++){
  test(`level ${i+1}: known route is solvable within budget through public actions`,()=>{
    let s=initialState(createLevel(i));
    assert.equal(outcome(s.level,s.cells,0),'playing');
    const base=JSON.stringify(s.level.cells);
    for(const c of s.level.cells){
      if(c.fixed||c.solution===null)continue;
      const count=clockwiseDistance(s.cells[c.id].mask,c.solution);
      assert.ok(Number.isFinite(count));
      for(let n=0;n<count&&s.status==='playing';n++)s=turn(s,c.id);
    }
    assert.equal(s.status,'won');assert.ok(s.moves<=s.level.par);
    assert.equal(stars(s),3);assert.equal(JSON.stringify(s.level.cells),base);
    assert.ok(connected(s.level,s.cells).has(s.level.target));
  });
  test(`level ${i+1}: hints converge after arbitrary detours`,()=>{
    let s=initialState(createLevel(i));
    s=turn(s,0);s=turn(s,6);
    // Allow a sufficiently long budget only in this recovery fixture.
    s={...s,level:{...s.level,budget:100},hints:1};
    for(let n=0;n<80&&s.status==='playing';n++){
      const id=hint(s);assert.notEqual(id,null);s=turn(s,id);
    }
    assert.equal(s.status,'won');assert.equal(stars(s),1);
  });
}
test('four quarter turns preserve a tile; straight masks have a two-turn period',()=>{
  for(let m=1;m<16;m++)assert.equal(rotateMask(m,4),m);
  assert.equal(rotateMask(5,2),5);assert.equal(rotateMask(3,-1),9);
});
test('fixed/invalid cells and terminal inputs cannot consume moves',()=>{
  const s=initialState(createLevel(0));
  for(const id of [10,14,-1,25,1.2,NaN])assert.equal(turn(s,id),s);
  assert.equal(turn({...s,status:'won'},11).moves,0);
});
test('undo restores full cells and budget while retaining hint disclosure',()=>{
  const s={...initialState(createLevel(1)),hints:1};
  const turned=turn(s,11);const back=undo(turned);
  assert.deepEqual(back.cells,s.cells);assert.equal(back.moves,s.moves);assert.equal(back.hints,1);
  assert.equal(back.status,'playing');assert.equal(back.history.length,0);
});
test('last permitted action wins before budget exhaustion is considered',()=>{
  const level=createLevel(0);
  const solved=level.cells.map(c=>({...c,mask:c.solution??c.mask}));
  solved[11].mask=5;
  const s={...initialState(level),cells:solved,moves:level.budget-1};
  assert.equal(turn(s,11).status,'won');
});
test('budget loss can be undone and retry starts clean',()=>{
  const level=createLevel(0);let s={...initialState(level),moves:level.budget-1};
  s=turn(s,0);assert.equal(s.status,'lost');assert.equal(turn(s,1),s);
  s=undo(s);assert.equal(s.status,'playing');assert.equal(s.moves,level.budget-1);
  assert.deepEqual(initialState(level),initialState(level));
});
test('connections require reciprocal openings and cannot wrap rows',()=>{
  const level=createLevel(0);const cells=level.cells.map(c=>({...c,mask:0}));
  cells[10].mask=2;cells[11].mask=2;
  assert.deepEqual([...connected(level,cells)],[10]);
  cells[11].mask=8;assert.deepEqual([...connected(level,cells)],[10,11]);
  const edge={...level,source:4};cells[4].mask=2;cells[5].mask=8;
  assert.deepEqual([...connected(edge,cells)],[4]);
});
test('every relay must be powered even if target is reached',()=>{
  const level=createLevel(0),cells=level.cells.map(c=>({...c,mask:c.solution??0}));
  cells[0].relay=true;assert.equal(outcome(level,cells,0),'playing');
});
test('input replay is deterministic and does not mutate snapshots',()=>{
  function replay(){let s=initialState(createLevel(2));for(const id of [1,6,7,12,6])s=turn(s,id);return s;}
  const s=replay();assert.deepEqual(s,replay());
  assert.notEqual(s.cells,s.history.at(-1).cells);
});
test('invalid level ids fail explicitly',()=>{
  for(const i of [-1,6,NaN,1.1])assert.throws(()=>createLevel(i),RangeError);
});
test('corrupted/future saves return a usable fresh record',()=>{
  for(const raw of ['{','null','{"version":3}',null])assert.deepEqual(parseRecord(raw),emptyRecord());
  const dirty={version:1,best:{1:{moves:2,stars:3},2:{moves:-1,stars:4},99:{moves:1,stars:3}},events:[{type:'hacked'}],muted:false};
  const clean=parseRecord(JSON.stringify(dirty));assert.deepEqual(clean.best,{1:{moves:2,stars:3}});assert.deepEqual(clean.events,[]);assert.equal(clean.muted,false);
});
test('storage denied never throws and does not prevent rules execution',()=>{
  const storage={getItem(){throw new Error('denied');},setItem(){throw new Error('quota');}};
  const loaded=loadRecord(storage);assert.equal(loaded.persistent,false);
  assert.equal(saveRecord(storage,loaded.data),false);assert.equal(turn(initialState(createLevel(0)),11).moves,1);
});
test('local events are bounded and unknown personal fields are discarded on read',()=>{
  const raw=JSON.stringify({version:1,events:Array.from({length:250},()=>({type:'start',level:1,moves:0,at:'2026-10-25',email:'private@example.com'}))});
  const clean=parseRecord(raw);assert.equal(clean.events.length,200);assert.equal(clean.events[0].email,undefined);
});
