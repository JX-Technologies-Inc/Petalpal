import type { MonthlyGrowth, GrowthRecord } from '../flower-density-sandbox/monthly-growth/monthlyGrowthModel';
import type { GrowthPiece } from '../flower-density-sandbox/monthly-growth/growthCoverage';

export type LocalGrowthPiece = Omit<GrowthPiece, 'worldX' | 'worldY'> & {
  localOffsetX: number; localOffsetY: number;
};
export interface ParentRelativeGrowth {
  children: LocalGrowthPiece[];
  template: Omit<MonthlyGrowth, 'records'|'pieces'|'primary'|'companions'|'filler'|'coveredSamples'>;
}
/** Pure conversion of an existing approved arrangement. No hidden absolute
 * child coordinates, fixture generation, storage, or planting mutations. */
export function toParentRelativeGrowth(growth:MonthlyGrowth):ParentRelativeGrowth {
  const {records,pieces,primary,companions,filler,coveredSamples,...template}=growth;
  const anchors=new Map(records.map(parent=>[parent.id,parent]));
  return {template,children:pieces.map(piece=>{
    const parent=anchors.get(piece.parentId);
    if(!parent)throw new Error(`Growth piece has no real parent: ${piece.parentId}`);
    const {worldX,worldY,...local}=piece;
    return {...local,localOffsetX:worldX-parent.worldX,localOffsetY:worldY-parent.worldY};
  })};
}
/** Reconstruct every visual from the current authoritative anchor. Missing
 * parents discard their visuals, rather than leaving children at old positions. */
export function fromParentRelativeGrowth(recipe:ParentRelativeGrowth,parents:readonly GrowthRecord[]):MonthlyGrowth {
  const anchors=new Map(parents.map(parent=>[parent.id,parent]));
  const pieces:GrowthPiece[]=recipe.children.flatMap(child=>{
    const parent=anchors.get(child.parentId);if(!parent)return [];
    const {localOffsetX,localOffsetY,...piece}=child;
    return [{...piece,worldX:parent.worldX+localOffsetX,worldY:parent.worldY+localOffsetY}];
  });
  return {...recipe.template,records:parents.map(parent=>({...parent})),pieces,
    primary:pieces.filter(p=>p.kind==='primary'),companions:pieces.filter(p=>p.kind==='companion'),
    filler:pieces.filter(p=>p.kind==='filler'),supportTargetIds:parents.map(p=>p.id),
    // Reference coverage is retained as metadata; moved sample locations are
    // not reused as a current-world diagnostic overlay.
    coveredSamples:[]};
}
