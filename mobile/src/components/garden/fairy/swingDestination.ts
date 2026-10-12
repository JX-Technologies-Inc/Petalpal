import { SWING_MAP_X, SWING_MAP_Y, SWING_MAP_SCALE, SWING_MAP_ROTATION } from '../swingMapPlacement';

// Existing paved western approach endpoint, not a shortcut across the water.
// Attachment to the separate, original SwingEntity seat anchor happens on arrival.
export const SWING_APPROACH = { x: (453 - 76) / .52, y: (654 - 64) / .52 };
export const SWING_EXIT = { ...SWING_APPROACH };

export function hitsSwing(p: {x:number;y:number}, placement = {
  x: SWING_MAP_X, y: SWING_MAP_Y, scale: SWING_MAP_SCALE, rotation: SWING_MAP_ROTATION,
}) {
  const cx=placement.x+1312*placement.scale/2, cy=placement.y+1199*placement.scale/2;
  const a=-placement.rotation*Math.PI/180, dx=p.x-cx, dy=p.y-cy;
  const x=(dx*Math.cos(a)-dy*Math.sin(a))/placement.scale+656;
  const y=(dx*Math.sin(a)+dy*Math.cos(a))/placement.scale+599.5;
  return x>=140 && x<=1200 && y>=180 && y<=1100;
}
