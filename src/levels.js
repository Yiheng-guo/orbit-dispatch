export const DIRECTIONS = [[0,-1,1,4],[1,0,2,8],[0,1,4,1],[-1,0,8,2]];
export const rotateMask = (mask, turns = 1) => {
  let m = mask;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) m = ((m << 1) & 15) | (m >> 3);
  return m;
};
const routes = [
  [[0,2],[1,2],[2,2],[3,2],[4,2]],
  [[0,2],[1,2],[1,1],[2,1],[3,1],[3,2],[4,2]],
  [[0,2],[0,1],[1,1],[1,2],[2,2],[2,3],[3,3],[4,3],[4,2]],
  [[0,2],[0,3],[1,3],[1,2],[1,1],[2,1],[2,2],[3,2],[3,3],[4,3],[4,2]],
  [[0,2],[0,1],[0,0],[1,0],[1,1],[2,1],[2,2],[2,3],[3,3],[3,4],[4,4],[4,3],[4,2]],
  [[0,2],[1,2],[1,3],[0,3],[0,4],[1,4],[2,4],[2,3],[2,2],[2,1],[3,1],[3,0],[4,0],[4,1],[4,2]],
];
const names = ['初次通联','绕行星云','折返信号','环带穿行','远岸灯塔','最后的航线'];
const tips = [
  '点击暗色线路旋转 90°，把左侧能源接到右侧星港。',
  '线路会转弯。先观察出口方向，再规划你的连接。',
  '点亮每一座中继站，星港才会接受能源。',
  '有些线路只是岔路，不必让所有格子都亮起。',
  '先找中继站，再把两端的航线连在一起。',
  '绕过废弃航道，让所有中继站在同一张能源网里。',
];
function bitBetween(a, b) {
  const d = DIRECTIONS.find(([dx,dy]) => a[0]+dx===b[0] && a[1]+dy===b[1]);
  if (!d) throw new Error('Non-adjacent route cells');
  return d[2];
}
export function clockwiseDistance(from, to) {
  for (let n=0;n<4;n++) if (rotateMask(from,n)===to) return n;
  return Infinity;
}
export function createLevel(index) {
  if (!Number.isInteger(index) || index<0 || index>=routes.length) throw new RangeError('Unknown level');
  const route=routes[index];
  const cells=Array.from({length:25},(_,id)=>({id, mask: [3,5,6,10,9][(id*7+index*3)%5], fixed:false, relay:false, solution:null}));
  route.forEach((pos,k)=>{
    const id=pos[1]*5+pos[0];
    const solution=(k===0?8:bitBetween(pos,route[k-1])) | (k===route.length-1?2:bitBetween(pos,route[k+1]));
    const fixed=k===0 || k===route.length-1;
    const turns=fixed?0:(k+index)%3+1;
    cells[id]={id,mask:rotateMask(solution,turns),fixed,relay:!fixed && (k===Math.floor(route.length/2) || (index>=2 && k===2) || (index>=4 && k===route.length-3)),solution};
  });
  const par=cells.reduce((n,c)=>n+(c.solution===null || c.fixed?0:clockwiseDistance(c.mask,c.solution)),0);
  return {id:index+1,index,name:names[index],tip:tips[index],width:5,height:5,cells,source:10,target:14,par,budget:par+6+index};
}
export const LEVEL_COUNT=routes.length;
