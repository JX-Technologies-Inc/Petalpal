import {Group,Image,useImage} from '@shopify/react-native-skia';
import {useDerivedValue,type SharedValue} from 'react-native-reanimated';
import {FIRST_APPROVED_LAYERS} from './fairyExtractedAssets';
import {fairyGait} from './fairyLocomotion';

type Layer=typeof FIRST_APPROVED_LAYERS[number];
export function useFairyLayerImages() {
  // Explicit fixed hooks: decoded images survive the world/seat parent handoff.
  const image0=useImage(FIRST_APPROVED_LAYERS[0].source);
  const image1=useImage(FIRST_APPROVED_LAYERS[1].source);
  const image2=useImage(FIRST_APPROVED_LAYERS[2].source);
  const image3=useImage(FIRST_APPROVED_LAYERS[3].source);
  const image4=useImage(FIRST_APPROVED_LAYERS[4].source);
  const image5=useImage(FIRST_APPROVED_LAYERS[5].source);
  const image6=useImage(FIRST_APPROVED_LAYERS[6].source);
  const image7=useImage(FIRST_APPROVED_LAYERS[7].source);
  const image8=useImage(FIRST_APPROVED_LAYERS[8].source);
  const image9=useImage(FIRST_APPROVED_LAYERS[9].source);
  const image10=useImage(FIRST_APPROVED_LAYERS[10].source);
  const image11=useImage(FIRST_APPROVED_LAYERS[11].source);
  const image12=useImage(FIRST_APPROVED_LAYERS[12].source);
  const image13=useImage(FIRST_APPROVED_LAYERS[13].source);
  const image14=useImage(FIRST_APPROVED_LAYERS[14].source);
  const image15=useImage(FIRST_APPROVED_LAYERS[15].source);
  const image16=useImage(FIRST_APPROVED_LAYERS[16].source);
  const image17=useImage(FIRST_APPROVED_LAYERS[17].source);
  return [image0,image1,image2,image3,image4,image5,image6,image7,image8,image9,image10,image11,image12,image13,image14,image15,image16,image17];
}
type Motion={seated:SharedValue<number>;gaitPhase:SharedValue<number>;gaitWeight:SharedValue<number>};
function Piece({layer,image,seated,gaitPhase,gaitWeight}:Motion&{layer:Layer;image:ReturnType<typeof useImage>}) {
  const leg=layer.id==='leg_left'||layer.id==='leg_right';
  const knee=layer.id==='leg_left'?{x:629,y:842}:{x:686,y:833};
  const side=layer.id==='leg_left'?1:-1;
  const thigh=useDerivedValue(()=>[{rotate:-.65*seated.value+side*fairyGait(gaitPhase.value,gaitWeight.value).leg}]);
  const shin=useDerivedValue(()=>[{rotate:.95*seated.value+(side===1
    ?fairyGait(gaitPhase.value,gaitWeight.value).kneeLeft:fairyGait(gaitPhase.value,gaitWeight.value).kneeRight)}]);
  const wing=layer.id==='wing_left'||layer.id==='wing_right';
  const petal=layer.id==='dress_side_petals'||layer.id==='dress_back_petals';
  const secondary=useDerivedValue(()=>[{rotate:wing
    ?fairyGait(gaitPhase.value,gaitWeight.value).wing*(layer.id==='wing_left'?1:-1)
    :petal?fairyGait(gaitPhase.value,gaitWeight.value).petal:0}]);
  if(!image)return null;
  const drawing=<Image image={image} x={0} y={0} width={1254} height={1254} fit="fill"/>;
  if(!leg)return <Group origin={wing?{x:662,y:365}:{x:655,y:450}} transform={secondary}>{drawing}</Group>;
  return <Group origin={{x:655,y:676}} transform={thigh}>
    <Group clip={{x:0,y:0,width:1254,height:knee.y}}>{drawing}</Group>
    <Group origin={knee} transform={shin}>
      <Group clip={{x:0,y:knee.y,width:1254,height:1254-knee.y}}>{drawing}</Group>
    </Group>
  </Group>;
}
/** Rest pose exactly reassembles source pixels; rigid motion is deliberately small.
 * Arms remain registered: the extraction lacks safe hidden shoulder/elbow overlap.
 */
export function FairyExtractedLayers({images,...motion}:Motion&{images:ReturnType<typeof useFairyLayerImages>}) {
  const body=useDerivedValue(()=>[{translateY:fairyGait(motion.gaitPhase.value,motion.gaitWeight.value).bodyY}]);
  if(images.some(image=>!image))return null;
  return <Group transform={body}>{FIRST_APPROVED_LAYERS.map((layer,i)=><Piece key={layer.id} layer={layer} image={images[i]} {...motion}/>)}</Group>;
}
