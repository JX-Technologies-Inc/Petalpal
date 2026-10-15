import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { FeatureActionButton, ui } from './FeatureUI';
export function PrivacyAndSupport(){
 const [status,setStatus]=useState('');
 async function open(url?:string){if(!url){setStatus('This policy URL is awaiting publication. Contact contact@jastrevia.com.');return;}try{await Linking.openURL(url);}catch{setStatus('Unable to open the link. Please contact contact@jastrevia.com.');}}
 return <View style={{gap:10}}><Text accessibilityRole="header" style={ui.title}>Privacy & support</Text>
 <Text style={ui.text}>PetalPal is a Jastrevia journaling app. Your account, entries, selected photos and social content are stored to provide the app. Journals and photos stay owner-only and are excluded from Event memory and reflections. Social profiles and messages are visible to permitted users. Optional AI shares eligible text or voice with the processors disclosed in AI & privacy. Firebase handles sign-in; hosting services process app data. Deletion removes active account data; security records, backups and provider copies may remain.</Text>
 <Text style={ui.text}>PetalPal is not a therapist, medical diagnostic tool or emergency service. AI may be wrong. If you or someone else is in immediate danger, contact local emergency services or a trusted person who can help now.</Text>
 <FeatureActionButton secondary title="Privacy Policy" onPress={()=>void open(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL)}/>
 <FeatureActionButton secondary title="Terms of Use" onPress={()=>void open(process.env.EXPO_PUBLIC_TERMS_URL)}/>
 <FeatureActionButton secondary title="Account & Data Deletion Policy" onPress={()=>void open(process.env.EXPO_PUBLIC_DELETION_URL)}/>
 <FeatureActionButton secondary title="Contact support" onPress={()=>void open('mailto:contact@jastrevia.com')}/>
 <Text style={ui.caption}>contact@jastrevia.com — delivery pending owner verification for this draft. Do not send passwords or private entries. Legal publisher confirmation and public policies are required before release.</Text>
 {status?<Text accessibilityRole="alert" style={ui.text}>{status}</Text>:null}</View>;
}
