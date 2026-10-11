import { distance, interpolate, type Point } from './walkNetwork';
import { SWING_MAP_X, SWING_MAP_Y, SWING_MAP_SCALE, SWING_MAP_ROTATION } from '../swingMapPlacement';
// Foot pivots registered to the existing bench. Enter its open suspension
// aperture from behind the backrest before settling at the seat.
function swingPoint(x:number,y:number):Point {
  const a=SWING_MAP_ROTATION*Math.PI/180,dx=(x-656)*SWING_MAP_SCALE,dy=(y-599.5)*SWING_MAP_SCALE;
  return {x:SWING_MAP_X+656*SWING_MAP_SCALE+dx*Math.cos(a)-dy*Math.sin(a),y:SWING_MAP_Y+599.5*SWING_MAP_SCALE+dx*Math.sin(a)+dy*Math.cos(a)};
}
export const SWING_SEAT_ANCHOR=swingPoint(653,740);
export const SWING_FLIGHT_APPROACH=swingPoint(653,850);
export const SWING_FLIGHT_SEAT=swingPoint(653,1000);
type Obstacle={x:number;y:number;rx:number;ry:number};
// Aerial silhouette clearance, independent of ground walkability.
export const FLIGHT_OBSTACLES:Obstacle[]=[
  {x:540,y:290,rx:475,ry:400}, // treehouse
  {x:1189,y:665,rx:145,ry:175}, // pavilion
  {x:1575,y:605,rx:145,ry:95}, // upper bridge
  {x:1610,y:1040,rx:225,ry:115}, // central bridge
  {x:1720,y:1470,rx:150,ry:140}, // lower bridge
  {x:1950,y:650,rx:175,ry:170}, // tea landmark
  {x:1930,y:1180,rx:130,ry:150}, // moon seat
  {x:756,y:1125,rx:66,ry:185}, // swing left post
  {x:1006,y:1149,rx:66,ry:185}, // swing right post
  {x:884,y:1000,rx:175,ry:65}, // swing beam
];
const radius=(p:Point,o:Obstacle)=>Math.hypot((p.x-o.x)/o.rx,(p.y-o.y)/o.ry);
export function flightSegmentClear(a:Point,b:Point,obstacles=FLIGHT_OBSTACLES){
  const count=Math.max(2,Math.ceil(distance(a,b)/8));
  return obstacles.every(o=>{const initial=radius(a,o);let previous=initial;
    for(let i=1;i<=count;i++){const r=radius(interpolate(a,b,i/count),o);
      // A walker already in a clearance margin may leave it, never dive inward.
      if(r<1&&(initial>=1||r<previous-.0001))return false;previous=r;}
    return true;});
}
const quadratic=(a:Point,c:Point,b:Point,t:number)=>interpolate(interpolate(a,c,t),interpolate(c,b,t),t);
export const createSwingFlight=(start:Point)=>createAerialFlight(start,SWING_FLIGHT_APPROACH);
export function createAerialFlight(start:Point,end:Point):Point[]|null {
  const d=distance(start,end),mid=interpolate(start,end,.5);
  // A valid paved destination may touch a landmark clearance margin (bridge
  // landing, pavilion path). Permit a final inward descent, never traversal
  // through that obstacle to the opposite side.
  const clear=(a:Point,b:Point)=>FLIGHT_OBSTACLES.every(o=>{
    if(flightSegmentClear(a,b,[o]))return true;
    return radius(end,o)<1 && radius(b,o)>=radius(end,o)-.0001
      && distance(b,end)<=distance(a,end)+.0001 && flightSegmentClear(b,a,[o]);
  });
  for(const bend of [30,-30,100,-100,220,-220]){
    const c={x:mid.x-(end.y-start.y)/Math.max(d,1)*bend,y:mid.y+(end.x-start.x)/Math.max(d,1)*bend};
    const curve=Array.from({length:81},(_,i)=>quadratic(start,c,end,i/80));
    if(curve.slice(1).every((p,i)=>clear(curve[i],p)))return curve;
  }
  // A small aerial visibility graph only skirts actual large obstacles.
  const nodes=[start,end,...FLIGHT_OBSTACLES.flatMap(o=>Array.from({length:16},(_,i)=>({
    x:o.x+o.rx*1.18*Math.cos(i*Math.PI/8),y:o.y+o.ry*1.18*Math.sin(i*Math.PI/8),
  })).filter(p=>FLIGHT_OBSTACLES.every(other=>radius(p,other)>1.04)))];
  const costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),open=new Set(nodes.map((_,i)=>i));costs[0]=0;
  while(open.size){let u=-1;for(const i of open)if(u<0||costs[i]<costs[u])u=i;
    if(!Number.isFinite(costs[u])||u===1)break;open.delete(u);
    for(const v of open){const cost=costs[u]+distance(nodes[u],nodes[v]);
      if(cost<costs[v]&&clear(nodes[u],nodes[v])){costs[v]=cost;previous[v]=u;}}}
  if(!Number.isFinite(costs[1]))return null;
  const waypoints:Point[]=[];for(let i=1;i!==-1;i=previous[i])waypoints.unshift(nodes[i]);
  const result=[start];
  for(let i=1;i<waypoints.length-1;i++){
    const a=waypoints[i-1],c=waypoints[i],b=waypoints[i+1];
    for(const fraction of [.24,.12,.06,.02]){
      const before=interpolate(c,a,fraction),after=interpolate(c,b,fraction);
      const arc=Array.from({length:21},(_,j)=>quadratic(before,c,after,j/20));
      if(arc.slice(1).every((p,j)=>clear(arc[j],p))){result.push(...arc);break;}}}
  result.push(end);return result;
}
export const smooth=(t:number)=>t*t*(3-2*t);
export function sampleFlight(points:Point[],progress:number):Point {
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));
  let remaining=lengths.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,progress));
  for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i])return interpolate(points[i],points[i+1],lengths[i]?remaining/lengths[i]:1);remaining-=lengths[i];}
  return points[points.length-1];
}
