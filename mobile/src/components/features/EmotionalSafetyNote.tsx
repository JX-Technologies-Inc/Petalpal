import { Text, View } from 'react-native';
import { GENERAL_SUPPORT, immediateSupportHint } from '../../services/emotionalSafety';
import { ui } from './FeatureUI';
export function EmotionalSafetyNote({text=''}:{text?:string}) {
 const hint=immediateSupportHint(text);
 return <View style={{gap:8}}><Text style={ui.caption}>{GENERAL_SUPPORT}</Text>{hint?<Text accessibilityRole="alert" style={ui.text}>{hint}</Text>:null}</View>;
}
