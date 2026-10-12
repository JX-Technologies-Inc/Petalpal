import { TREEHOUSE_MAP_X, TREEHOUSE_MAP_Y, TREEHOUSE_MAP_SCALE } from '../treehouseMapPlacement';
import type { Point } from './walkNetwork';

// Full 1448 x 1086 tree registration; the mailbox layer is offset +60,+135.
// These foot anchors stay on the existing dry entrance surface beside it.
const world = (x:number,y:number):Point => ({
  x:TREEHOUSE_MAP_X+x*TREEHOUSE_MAP_SCALE,
  y:TREEHOUSE_MAP_Y+y*TREEHOUSE_MAP_SCALE,
});
export const mailboxApproachAnchor=world(1050,990);
export const mailboxInteractionAnchor=world(1030,930);
export const mailboxPresentAnchor=world(1050,1010);
export const mailboxExitAnchor=mailboxPresentAnchor;
export const MAILBOX_TIMING={retrieveMs:1400,turnMs:1100,unfoldMs:1000,holdMs:800} as const;

export function hitsMailbox(p:Point,placement={x:TREEHOUSE_MAP_X,y:TREEHOUSE_MAP_Y,scale:TREEHOUSE_MAP_SCALE}){
  const x=(p.x-placement.x)/placement.scale,y=(p.y-placement.y)/placement.scale;
  // Follow the roof, letter box and post, not the nearby doorway or canopy.
  // Evaluate this specific landmark before the broad treehouse hit region.
  return ((x-988)/68)**2+((y-802)/118)**2<=1;
}
