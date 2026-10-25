import { DIRECTIONS, rotateMask, clockwiseDistance } from './levels.js';

export function connected(level, cells) {
  const visited=new Set([level.source]), queue=[level.source];
  for(let q=0;q<queue.length;q++) {
    const id=queue[q], x=id%level.width, y=Math.floor(id/level.width);
    for(const [dx,dy,bit,opposite] of DIRECTIONS) {
      const nx=x+dx, ny=y+dy;
      if(nx<0||nx>=level.width||ny<0||ny>=level.height) continue;
      const next=ny*level.width+nx;
      if((cells[id].mask&bit) && (cells[next].mask&opposite) && !visited.has(next)) {
        visited.add(next);queue.push(next);
      }
    }
  }
  return visited;
}
export function outcome(level,cells,moves) {
  const lit=connected(level,cells);
  if(lit.has(level.target) && cells.every(c=>!c.relay || lit.has(c.id))) return 'won';
  return moves>=level.budget?'lost':'playing';
}
export function initialState(level) {
  return {level,cells:level.cells.map(c=>({...c})),moves:0,status:'playing',history:[],hints:0};
}
export function turn(state,id) {
  if(state.status!=='playing' || !Number.isInteger(id) || !state.cells[id] || state.cells[id].fixed) return state;
  const cells=state.cells.map(c=>({...c}));cells[id].mask=rotateMask(cells[id].mask);
  const moves=state.moves+1;
  return {...state,cells,moves,status:outcome(state.level,cells,moves),history:[...state.history,{cells:state.cells,moves:state.moves}]};
}
export function undo(state) {
  if(!state.history.length || state.status==='won') return state;
  const prior=state.history.at(-1);
  return {...state,...prior,history:state.history.slice(0,-1),status:'playing'};
}
export function hint(state) {
  if(state.status!=='playing') return null;
  // The known solution is recoverable from every rotation, even after a detour.
  return state.cells.find(c=>!c.fixed && c.solution!==null && clockwiseDistance(c.mask,c.solution)>0)?.id ?? null;
}
export function stars(state) {
  if(state.status!=='won') return 0;
  if(state.hints>0) return 1;
  return state.moves<=state.level.par?3:state.moves<=state.level.par+3?2:1;
}
