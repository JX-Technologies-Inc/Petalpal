// Visible alpha silhouette (alpha > .5) measured on approved source PNGs.
// Excludes transparent padding. Keep sprite size and decision height in sync.
export const WALK_SPRITE_HEIGHT=153.6;
export const WALK_VISIBLE_ROWS=[1257,1260,1236,1236,1249,1251,1263,1268];
export const walkVisualHeight=(frame=3)=>WALK_SPRITE_HEIGHT*WALK_VISIBLE_ROWS[frame]/1536;
export const FLY_VISUAL_HEIGHT=150*1352/1448;
export const SEATED_VISUAL_HEIGHT=((1287/1402-.59)*470*1.55+(.59-134/1402)*470)*.3;
