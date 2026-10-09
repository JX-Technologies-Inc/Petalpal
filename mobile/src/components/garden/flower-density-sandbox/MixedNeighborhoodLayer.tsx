import { Circle, Group, Line } from '@shopify/react-native-skia';
import type { Neighborhood, NeighborhoodFlower } from './mixedNeighborhoods';

const COLORS=['#93436e','#277d9c','#987120','#5356a1','#398169','#ae573b','#7a743b'];
// Diagnostic only. This does not influence the preview layout or its compositions.
export function MixedNeighborhoodLayer({neighborhoods,flowers}:{neighborhoods:readonly Neighborhood[];flowers:readonly NeighborhoodFlower[]}) {
  if(!__DEV__)return null;
  const byId=new Map(flowers.map(f=>[f.id,f]));
  return <Group>{neighborhoods.map((n,i)=><Group key={n.id}>
    {n.flowerIds.map(id=>{const f=byId.get(id)!;return <Group key={id}>
      <Line p1={{x:n.x,y:n.y}} p2={{x:f.worldX,y:f.worldY}} color={COLORS[i%COLORS.length]} strokeWidth={.7} opacity={.65}/>
      <Circle cx={f.worldX} cy={f.worldY} r={3} color={COLORS[i%COLORS.length]} style="stroke" strokeWidth={1}/>
    </Group>;})}
  </Group>)}</Group>;
}
