import { MOON_BED_MAP_X as x,MOON_BED_MAP_Y as y,MOON_BED_MAP_SCALE as scale,MOON_BED_MAP_ROTATION as rotation } from '../moonBedMapPlacement';
export const MOON_EXIT={x:(1033-76)/.52,y:(625-64)/.52};
function point(px:number,py:number){const a=rotation*Math.PI/180,dx=(px-656)*scale,dy=(py-599.5)*scale;return {x:x+656*scale+dx*Math.cos(a)-dy*Math.sin(a),y:y+599.5*scale+dx*Math.sin(a)+dy*Math.cos(a)};}
export const MOON_APPROACH=point(620,1100);
export const MOON_SLEEP_ANCHOR=point(720,880);
export function hitsMoonBed(p:{x:number;y:number},placement={x,y,scale,rotation}){const a=-placement.rotation*Math.PI/180,dx=p.x-placement.x-656*placement.scale,dy=p.y-placement.y-599.5*placement.scale;const px=(dx*Math.cos(a)-dy*Math.sin(a))/placement.scale+656,py=(dx*Math.sin(a)+dy*Math.cos(a))/placement.scale+599.5;return px>=280&&px<=1130&&py>=150&&py<=1080;}
