import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../services/auth';
import { apiRequest } from '../../services/api';
import { FeatureActionButton, ui } from './FeatureUI';
// Weekly reflections are written in English or Simplified Chinese, chosen from the
// owner's preferredLocale (server: weeklyReportLocale). Saved through the owner-only
// PUT /users/:id/profile, which accepts only preferredLocale.
type ReportLanguage='en'|'zh-Hans';
const LABELS:Record<ReportLanguage,string>={en:'English','zh-Hans':'简体中文'};
const reportLanguage=(locale?:string|null):ReportLanguage|null=>{const l=(locale||'').toLowerCase();
 if(/^en(?:-|$)/.test(l))return 'en';if(/^zh(?:-|$)/.test(l)&&!/(?:^|-)(hant|tw|hk|mo)(?:-|$)/.test(l))return 'zh-Hans';return null;};
type Profile={user?:{preferredLocale?:string}};
export function ReportLanguageSettings() {
 const {session}=useAuth(); const owner=session?.user.id;
 const [value,setValue]=useState<ReportLanguage|null>(null),[busy,setBusy]=useState(true),[status,setStatus]=useState('');
 useEffect(()=>{let active=true;if(!owner)return;apiRequest<Profile>('/session?view=metadata').then(r=>{if(active)setValue(reportLanguage(r.user?.preferredLocale));}).catch(e=>{if(active)setStatus(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[owner]);
 async function save(next:ReportLanguage){if(!owner||busy||next===value)return;setBusy(true);setStatus('');try{const r=await apiRequest<Profile>(`/users/${owner}/profile`,'PUT',{preferredLocale:next});setValue(reportLanguage(r.user?.preferredLocale));setStatus('Report language saved.');}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}
 return <View style={{gap:8}}><Text style={ui.text}>Weekly reflection language: {value?LABELS[value]:'not set'}</Text>
  <View style={ui.row}>{(['en','zh-Hans'] as const).map(l=><FeatureActionButton key={l} secondary={l!==value} title={LABELS[l]} disabled={busy||!owner||l===value} onPress={()=>void save(l)}/>)}</View>
  {status?<Text style={ui.caption}>{status}</Text>:null}</View>;
}
