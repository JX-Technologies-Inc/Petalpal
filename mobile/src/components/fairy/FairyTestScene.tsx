import {FAIRY_ASSETS} from './fairyAssets';
import {FairyPlaybackPanel} from './FairyPlaybackPanel';
import {createFairyPlayback,fairyClipDescriptor,pauseFairy} from './fairyPlayback';
import {Canvas,Circle,Group,Rect} from '@shopify/react-native-skia';
import {useCallback,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {FairyLayer,type FairyVisualStatus} from './FairyLayer';
import {FAIRY_ANIMATION_STATES,FAIRY_FACINGS,findFairyClip,type FairyRuntime} from './fairyRuntime';

const INITIAL:FairyRuntime={x:320,y:330,scale:.28,facing:'front',animationState:'idle',visible:true};
/** Independent of GardenScene, planting, Journal and backend. Entire reference
 * sheet displayed as-is; state switches do not pretend that poses are sprites. */
export default function FairyTestScene() {
  const [runtime,setRuntime]=useState<FairyRuntime>(INITIAL);
  const [playback,setPlayback]=useState(()=>createFairyPlayback(fairyClipDescriptor(FAIRY_ASSETS,INITIAL.animationState,INITIAL.facing)));
  const sourceType=playback.clip?findFairyClip(FAIRY_ASSETS,runtime.animationState,runtime.facing)?.kind??'reference':'reference';
  const [size,setSize]=useState({width:640,height:360});
  const [status,setStatus]=useState<FairyVisualStatus>('loading');
  const onStatus=useCallback((next:FairyVisualStatus)=>setStatus(next),[]);
  const fit=Math.min(size.width/640,size.height/480);
  const button=(label:string,action:()=>void)=><Pressable key={label} accessibilityRole="button" style={styles.button} onPress={action}><Text>{label}</Text></Pressable>;
  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.title}>Fairy — isolated DEV runtime</Text>
    <Text>Approved character reference only. Whole sheet unchanged; no animation frames or facing transforms are present.</Text>
    <View style={styles.stage} onLayout={({nativeEvent:{layout}})=>setSize({width:layout.width,height:layout.height})}>
      <Canvas style={styles.canvas}>
        <Group transform={[{translateX:(size.width-640*fit)/2},{translateY:(size.height-480*fit)/2},{scale:fit}]}>
          <Rect x={0} y={0} width={640} height={480} color="#eef3ed"/>
          <FairyLayer {...runtime} frameIndex={playback.frameIndex} viewport={{x:0,y:0,width:640,height:480}} onStatus={onStatus}/>
          {runtime.visible&&<Circle cx={runtime.x} cy={runtime.y} r={4} color="#45614c"/>}
        </Group>
      </Canvas>
    </View>
    <Text selectable>Runtime: {status}{'\n'}World x: {runtime.x} / y: {runtime.y}{'\n'}Scale: {runtime.scale.toFixed(2)}{'\n'}Facing: {runtime.facing}{'\n'}Animation state: {runtime.animationState}{'\n'}Visible: {String(runtime.visible)}</Text>
    <FairyPlaybackPanel runtime={runtime} playback={playback} sourceType={sourceType} onChange={setPlayback}/>
    <Text>Bottom-center pivot of the reference sheet is provisional, not a calibrated Fairy foot anchor. Future Blender frames provide their own ground pivot.</Text>
    <View style={styles.row}>{[['Left',-20,0],['Right',20,0],['Up',0,-20],['Down',0,20]].map(([label,dx,dy])=>button(String(label),()=>setRuntime(r=>({...r,x:r.x+Number(dx),y:r.y+Number(dy)}))))}</View>
    <View style={styles.row}>{button('Smaller',()=>setRuntime(r=>({...r,scale:Math.max(.05,Number((r.scale-.05).toFixed(2)))})))}{button('Larger',()=>setRuntime(r=>({...r,scale:Math.min(1,Number((r.scale+.05).toFixed(2)))})))}{button(runtime.visible?'Hide':'Show',()=>{setRuntime(r=>({...r,visible:!r.visible}));setPlayback(pauseFairy(playback));})}{button('Reset',()=>{setRuntime({...INITIAL});setPlayback(createFairyPlayback(fairyClipDescriptor(FAIRY_ASSETS,INITIAL.animationState,INITIAL.facing)));})}</View>
    <Text>Facing request</Text><View style={styles.row}>{FAIRY_FACINGS.map(facing=>button(facing,()=>{setRuntime(r=>({...r,facing}));setPlayback(createFairyPlayback(fairyClipDescriptor(FAIRY_ASSETS,runtime.animationState,facing)));}))}</View>
    <Text>Animation request (static reference fallback)</Text><View style={styles.row}>{FAIRY_ANIMATION_STATES.map(animationState=>button(animationState,()=>{setRuntime(r=>({...r,animationState}));setPlayback(createFairyPlayback(fairyClipDescriptor(FAIRY_ASSETS,animationState,runtime.facing)));}))}</View>
    <Text>One image node; zero playback timers. Reference: 1448×1086, approximately 6.00 MiB decoded RGBA. Use native frame/memory tooling on this route before adding actual clips. Display scale changes do not alter the source image.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({page:{padding:16,gap:12},title:{fontSize:20,fontWeight:'600'},
  stage:{height:360,width:'100%',overflow:'hidden'},canvas:{position:'absolute',top:0,right:0,bottom:0,left:0},
  row:{flexDirection:'row',flexWrap:'wrap',gap:6},button:{padding:12,minHeight:44,backgroundColor:'#e4ece0',borderRadius:6}});
