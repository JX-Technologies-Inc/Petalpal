import {Atlas,Group,Skia,type SkImage} from '@shopify/react-native-skia';
import {useDerivedValue,type SharedValue} from 'react-native-reanimated';
import {useMemo} from 'react';
import {FAIRY_POSE_FRAMES} from './fairyPoseMetadata';

type Props={image:SkImage;index:SharedValue<number>;next:SharedValue<number>;mix:SharedValue<number>;anchor:'root'|'hips'};
function Pose({image,index,mix,anchor,incoming}:Omit<Props,'next'>&{incoming:boolean}) {
  // Construct Skia objects after the atlas is decoded, not during web module load.
  const rectangles=useMemo(()=>FAIRY_POSE_FRAMES.map(p=>Skia.XYWHRect(p.rect[0],p.rect[1],p.rect[2],p.rect[3])),[]);
  const registrations=useMemo(()=>FAIRY_POSE_FRAMES.map(p=>({root:Skia.RSXform(1,0,-p.root[0],-p.root[1]),
    hips:Skia.RSXform(1,0,-p.hips[0],-p.hips[1])})),[]);
  const sprites=useDerivedValue(()=>[rectangles[index.value]]);
  const transforms=useDerivedValue(()=>[registrations[index.value][anchor]]);
  const opacity=useDerivedValue(()=>incoming?mix.value:1-mix.value);
  return <Group opacity={opacity}><Atlas image={image} sprites={sprites} transforms={transforms}/></Group>;
}
/** Dedicated authored frames. No mirroring, rotation into a back view, or bone
 * transforms of the rejected standing cutout. One predecoded atlas is reused. */
export function FairyPoseSprite({next,...props}:Props) {
  return <><Pose {...props} incoming={false}/><Pose {...props} index={next} incoming/></>;
}
