import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { apiRequest } from '../../services/api';
import { FeatureActionButton, ui } from './FeatureUI';
export const COMMUNITY_VERSION = 'petalpal-community-2026-10-15';
export const COMMUNITY_TEXT = 'Be kind. Do not publish harassment, hateful attacks, threats, abusive profanity, sexual exploitation, illegal instructions, spam, private information about others, or content you do not have rights to share. Profiles and Flower messages are visible to other users. Reports may be reviewed and content removed or social access restricted. Private emotional reflection and asking for help are welcome. PetalPal is not an emergency service. Report harmful content or block its author in the app. Contact: contact@jastrevia.com (delivery pending verification for this release draft).';
export function CommunityGuidelines() {
  const [accepted,setAccepted]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;apiRequest<{accepted:boolean}>('/users/me/community-acceptance').then(v=>{if(active)setAccepted(v.accepted);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  return <View style={{gap:8}}><Text accessibilityRole="header" style={ui.title}>Community Guidelines</Text><Text style={ui.text}>{COMMUNITY_TEXT}</Text>
    <Text style={ui.caption}>Version {COMMUNITY_VERSION}. 社区准则：禁止骚扰、仇恨、威胁、性剥削、泄露隐私和侵权。可以举报或屏蔽用户。欢迎在私人日记中表达感受和寻求帮助。</Text>
    {accepted ? <Text style={ui.caption}>Accepted</Text> : <FeatureActionButton title="I accept the Community Guidelines" disabled={busy} onPress={async()=>{
      setBusy(true);setError('');try{await apiRequest('/users/me/community-acceptance','PUT',{version:COMMUNITY_VERSION,accepted:true});setAccepted(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
    }}/>}{error ? <Text accessibilityRole="alert" style={ui.text}>{error}</Text>:null}</View>;
}
