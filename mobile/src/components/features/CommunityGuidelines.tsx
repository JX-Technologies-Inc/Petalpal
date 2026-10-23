import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../services/auth';
import { momentLocale } from '../moments/momentFormat';
import { FeatureActionButton, ui } from './FeatureUI';
export const COMMUNITY_VERSION = 'petalpal-community-2026-10-15';
export const COMMUNITY_TEXT = 'Be kind. Do not publish harassment, hateful attacks, threats, abusive profanity, sexual exploitation, illegal instructions, spam, private information about others, or content you do not have rights to share. Profiles and Flower messages are visible to other users. Reports may be reviewed and content removed or social access restricted. Private emotional reflection and asking for help are welcome. PetalPal is not an emergency service. Report harmful content or block its author in the app. Contact: contact@jastrevia.com.';
// The guidelines stay folded until asked for; accepting them is one tap either way.
export function CommunityGuidelines() {
  const [accepted,setAccepted]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false);
  // English first; the Chinese summary only for owners who chose Simplified Chinese.
  const chinese=momentLocale(useAuth().experience?.user.preferredLocale)==='zh-Hans';
  useEffect(()=>{let active=true;apiRequest<{accepted:boolean}>('/users/me/community-acceptance').then(v=>{if(active)setAccepted(v.accepted);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  return <View style={{gap:8}}>
    <View style={ui.row}><Text accessibilityRole="header" style={[ui.title,{flex:1}]}>Community Guidelines</Text>{accepted ? <Text style={ui.caption}>Accepted</Text> : null}</View>
    <FeatureActionButton secondary title={open ? 'Hide the guidelines' : 'Read the guidelines'} onPress={()=>setOpen(!open)}/>
    {open ? <><Text style={ui.text}>{COMMUNITY_TEXT}</Text>
      <Text style={ui.caption}>Version {COMMUNITY_VERSION}.{chinese ? ' 社区准则：禁止骚扰、仇恨、威胁、性剥削、泄露隐私和侵权。可以举报或屏蔽用户。欢迎在私人日记中表达感受和寻求帮助。' : ''}</Text></> : null}
    {accepted === false ? <FeatureActionButton title="I accept the Community Guidelines" disabled={busy} onPress={async()=>{
      setBusy(true);setError('');try{await apiRequest('/users/me/community-acceptance','PUT',{version:COMMUNITY_VERSION,accepted:true});setAccepted(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}
    }}/> : null}{error ? <Text accessibilityRole="alert" style={ui.text}>{error}</Text>:null}</View>;
}
