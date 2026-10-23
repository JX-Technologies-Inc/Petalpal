import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { FeatureActionButton, ui } from './FeatureUI';
async function openPolicy(url:string|undefined,setStatus:(value:string)=>void){if(!url){setStatus('This policy URL is awaiting publication. Contact contact@jastrevia.com.');return;}try{await Linking.openURL(url);}catch{setStatus('Unable to open the link. Please contact contact@jastrevia.com.');}}
export function PrivacyAndSupport(){
 const [status,setStatus]=useState('');
 const open=(url?:string)=>openPolicy(url,setStatus);
 return <View style={{gap:10}}><Text accessibilityRole="header" style={ui.title}>Privacy & support</Text>
 <Text style={ui.text}>PetalPal is a Jastrevia journaling app. Your account, entries, selected photos and social content are stored to provide the app. Journals and photos stay owner-only and are excluded from Event memory and reflections. Social profiles and messages are visible to permitted users. Optional AI shares eligible text or voice with the processors disclosed in AI & privacy. Firebase handles sign-in; hosting services process app data. Deleting your account removes its data right away and we keep no backups of deleted accounts; only minimal security and deletion records remain, and data already sent to an AI provider follows that provider's retention.</Text>
 <Text style={ui.text}>PetalPal is not a therapist, medical diagnostic tool or emergency service. AI may be wrong. If you or someone else is in immediate danger, contact local emergency services or a trusted person who can help now.</Text>
 <FeatureActionButton secondary title="Privacy Policy" onPress={()=>void open(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)}/>
 <FeatureActionButton secondary title="Terms of Use" onPress={()=>void open(process.env.EXPO_PUBLIC_TERMS_URL)}/>
 <FeatureActionButton secondary title="Account & Data Deletion Policy" onPress={()=>void open(process.env.EXPO_PUBLIC_DELETION_URL)}/>
 <FeatureActionButton secondary title="Contact support" onPress={()=>void open('mailto:contact@jastrevia.com')}/>
 <Text style={ui.caption}>contact@jastrevia.com. Please do not send passwords or private entries.</Text>
 {status?<Text accessibilityRole="alert" style={ui.text}>{status}</Text>:null}</View>;
}

// Compact sign-in footer: links plus a one-line safety note; the full notice
// stays one tap away here and in the in-app Privacy & support panel.
export function PrivacyLinks(){
 const [expanded,setExpanded]=useState(false);
 const [status,setStatus]=useState('');
 const link={color:'#365b42',textDecorationLine:'underline' as const};
 if(expanded) return <View style={{gap:10}}><PrivacyAndSupport/>
  <Text accessibilityRole="button" style={[ui.caption,link]} onPress={()=>setExpanded(false)}>Hide privacy & support</Text></View>;
 return <View style={{gap:6}}>
  <Text style={[ui.caption,{textAlign:'center'}]}>By continuing, you agree to the{' '}
   <Text accessibilityRole="link" style={link} onPress={()=>void openPolicy(process.env.EXPO_PUBLIC_TERMS_URL,setStatus)}>Terms of Use</Text>{' '}and{' '}
   <Text accessibilityRole="link" style={link} onPress={()=>void openPolicy(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,setStatus)}>Privacy Policy</Text>.
   {' '}PetalPal is not a therapist or emergency service.</Text>
  <Text accessibilityRole="button" style={[ui.caption,link,{textAlign:'center'}]} onPress={()=>setExpanded(true)}>Privacy & support</Text>
  {status?<Text accessibilityRole="alert" style={ui.caption}>{status}</Text>:null}</View>;
}
