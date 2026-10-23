import { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { FeatureActionButton, ui } from './FeatureUI';
async function openPolicy(url:string|undefined,setStatus:(value:string)=>void){if(!url){setStatus('This policy URL is awaiting publication. Contact contact@jastrevia.com.');return;}try{await Linking.openURL(url);}catch{setStatus('Unable to open the link. Please contact contact@jastrevia.com.');}}
// Settings: the published policies, support and a way to report a problem, as buttons. The policy
// text itself lives on the published pages, not in the panel.
export function PrivacyAndSupport(){
 const [status,setStatus]=useState('');
 const open=(url?:string)=>openPolicy(url,setStatus);
 return <View style={{gap:10}}><Text accessibilityRole="header" style={ui.title}>Privacy & support</Text>
 <FeatureActionButton secondary title="Privacy Policy" onPress={()=>void open(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)}/>
 <FeatureActionButton secondary title="Terms of Use" onPress={()=>void open(process.env.EXPO_PUBLIC_TERMS_URL)}/>
 <FeatureActionButton secondary title="Account & Data Deletion" onPress={()=>void open(process.env.EXPO_PUBLIC_DELETION_URL)}/>
 <FeatureActionButton secondary title="Report a problem" onPress={()=>void open(problemReportUrl())}/>
 <FeatureActionButton secondary title="Contact support" onPress={()=>void open('mailto:contact@jastrevia.com')}/>
 <Text style={ui.caption}>PetalPal isn't an emergency service. If you or someone else is in danger, contact local emergency services.</Text>
 {status?<Text accessibilityRole="alert" style={ui.text}>{status}</Text>:null}</View>;
}

// A bug report by email, with what helps us reproduce it filled in. Nothing private is attached.
export function problemReportUrl(now=new Date()){
 const device=Platform.OS==='web'&&typeof navigator!=='undefined'?navigator.userAgent:`${Platform.OS} ${String(Platform.Version)}`;
 const body=['What happened:','','What you expected:','','Steps to make it happen again:','1.','',
  '— Please don\'t include passwords or private entries.',`Device: ${device}`,`Time: ${now.toISOString()}`].join('\n');
 return `mailto:contact@jastrevia.com?subject=${encodeURIComponent('PetalPal problem report')}&body=${encodeURIComponent(body)}`;
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
