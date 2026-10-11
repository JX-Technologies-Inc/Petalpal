import {TEA_SET_MAP_X as x,TEA_SET_MAP_Y as y,TEA_SET_MAP_SCALE as scale,TEA_SET_MAP_ROTATION as rotation} from '../teaSetMapPlacement';
// Existing tea-courtyard graph vertex; furniture never changes the walk network.
export const TEA_EXIT={x:(1066-76)/.52,y:(350-64)/.52};
function point(px:number,py:number){const a=rotation*Math.PI/180,dx=(px-768)*scale,dy=(py-512)*scale;return {x:x+768*scale+dx*Math.cos(a)-dy*Math.sin(a),y:y+512*scale+dx*Math.sin(a)+dy*Math.cos(a)};}
export const TEA_APPROACH=point(1300,1030);
export const TEA_SEAT=point(1200,800);
export function hitsTeaArea(p:{x:number;y:number},placement={x,y,scale,rotation}){
 const a=-placement.rotation*Math.PI/180,dx=p.x-placement.x-768*placement.scale,dy=p.y-placement.y-512*placement.scale;
 const px=(dx*Math.cos(a)-dy*Math.sin(a))/placement.scale+768,py=(dx*Math.sin(a)+dy*Math.cos(a))/placement.scale+512;
 // Broad paved courtyard, including both chairs and table; excludes the bridge.
 return ((px-820)/1150)**2+((py-640)/760)**2<=1;
}
