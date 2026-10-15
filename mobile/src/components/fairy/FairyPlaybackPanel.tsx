import {Pressable,StyleSheet,Text,View} from 'react-native';
import {pauseFairy,playFairy,stepFairy,type FairyPlaybackState} from './fairyPlayback';
import type {FairyRuntime,FairyVisualFrame} from './fairyRuntime';

export function FairyPlaybackPanel({runtime,playback,sourceType,onChange}:{
  runtime:FairyRuntime;playback:FairyPlaybackState;sourceType:FairyVisualFrame['kind'];
  onChange:(next:FairyPlaybackState)=>void;
}) {
  if(!__DEV__)return null;
  const unavailable=!playback.clip;
  const control=(label:string,action:()=>void)=><Pressable key={label} accessibilityRole="button"
    accessibilityState={{disabled:unavailable}} disabled={unavailable} onPress={action}
    style={[styles.button,unavailable&&styles.disabled]}><Text>{label}</Text></Pressable>;
  return <View style={styles.panel}>
    <Text style={styles.title}>Sprite playback — DEV</Text>
    {unavailable&&<Text style={styles.title}>NO PRODUCTION CLIP LOADED</Text>}
    <Text selectable>Animation state: {runtime.animationState}{'\n'}Facing direction: {runtime.facing}{'\n'}Frame index: {playback.frameIndex}{playback.clip?` / ${playback.clip.frameCount-1}`:' (reference only)'}{'\n'}FPS: {playback.clip?.fps??'—'}{'\n'}Playback status: {playback.status}{'\n'}Asset source type: {sourceType}</Text>
    <View style={styles.row}>
      {control('Play',()=>onChange(playFairy(playback)))}
      {control('Pause',()=>onChange(pauseFairy(playback)))}
      {control('Previous Frame',()=>onChange(stepFairy(playback,-1)))}
      {control('Next Frame',()=>onChange(stepFairy(playback,1)))}
    </View>
    <Text>{unavailable?'Controls are unavailable until authored assets are registered. The full static reference remains displayed.':'Manual stepping is available. Play sets the playback request; automatic shared-value clock wiring awaits real assets.'}</Text>
  </View>;
}
const styles=StyleSheet.create({panel:{padding:12,gap:8,backgroundColor:'#f0ece4',borderRadius:8},title:{fontWeight:'600'},
  row:{flexDirection:'row',flexWrap:'wrap',gap:6},button:{padding:12,minHeight:44,backgroundColor:'#e1e9db',borderRadius:6},disabled:{opacity:.45}});
