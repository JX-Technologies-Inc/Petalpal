import { useEffect, useState } from 'react';
import { Text, View, Switch } from 'react-native';
import { useAuth } from '../../services/auth';
import { apiRequest } from '../../services/api';
import { FeatureActionButton, ui } from './FeatureUI';
type Consent={aiProcessing:boolean;personalization:boolean;memoryEnabled:boolean};
type Disclosure={version:string;explanation:string;retention:string;features:{feature:string;processor:string;configured:boolean}[]};
export function AiPrivacySettings() {
 const {session}=useAuth(); const owner=session?.user.id;
 const [value,setValue]=useState<Consent>({aiProcessing:false,personalization:false,memoryEnabled:false});
 const [disclosure,setDisclosure]=useState<Disclosure|null>(null),[busy,setBusy]=useState(true),[status,setStatus]=useState('');
 useEffect(()=>{let active=true;if(!owner)return;Promise.all([apiRequest<Consent>(`/users/${owner}/ai-consent`),apiRequest<Disclosure>('/ai/disclosure')]).then(([c,d])=>{if(active){setValue(c);setDisclosure(d);}}).catch(e=>{if(active)setStatus(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[owner]);
 async function save(next:Consent){if(!owner || (!disclosure && (next.aiProcessing||next.personalization||next.memoryEnabled)))return;setBusy(true);setStatus('');try{setValue(await apiRequest(`/users/${owner}/ai-consent`,'PUT',{...next,...(disclosure?{disclosureVersion:disclosure.version}:{})}));setStatus('Privacy choices saved.');}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}
 return <View style={{gap:12}}><Text accessibilityRole="header" style={ui.title}>AI processing & privacy</Text>
 {disclosure ? <><Text style={ui.text}>{disclosure.explanation}</Text>{disclosure.features.map(f=><Text key={f.feature} style={ui.caption}>{f.feature}: {f.processor} — {f.configured?'configured':'unavailable'}</Text>)}<Text style={ui.text}>{disclosure.retention}</Text></>:<Text style={ui.text}>Loading the AI disclosure. Optional AI cannot be enabled until this is available.</Text>}
 {(['aiProcessing','personalization','memoryEnabled'] as const).map((key,i)=><View key={key} style={ui.row}><Text style={ui.text}>{['AI Processing','Personalization','Long-term Memory'][i]}</Text><Switch accessibilityLabel={['AI Processing','Personalization','Long-term Memory'][i]} value={value[key]} disabled={busy||!disclosure||(key!=='aiProcessing'&&!value.aiProcessing)||(key==='memoryEnabled'&&!value.personalization)} onValueChange={enabled=>setValue(v=>({...v,[key]:enabled,...(!enabled&&key==='aiProcessing'?{personalization:false,memoryEnabled:false}:{}),...(!enabled&&key==='personalization'?{memoryEnabled:false}:{})}))}/></View>)}
 <FeatureActionButton title="Save my AI choices" disabled={busy||!disclosure} onPress={()=>void save(value)}/>
 <FeatureActionButton secondary title="Withdraw all AI consent" disabled={busy} onPress={()=>void save({aiProcessing:false,personalization:false,memoryEnabled:false})}/>
 {status?<Text accessibilityRole="alert" style={ui.text}>{status}</Text>:null}</View>;
}
export function AiOutputReport({kind,outputId}:{kind:string;outputId:string}) {
 const [open,setOpen]=useState(false),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 return <View style={{gap:8}}><FeatureActionButton secondary title="Report AI output" onPress={()=>setOpen(!open)} disabled={busy}/>
 {open?<><Text style={ui.text}>Only the output reference and reason are sent. Your private text is not attached.</Text>{['HARASSMENT','HATE_SPEECH','SELF_HARM','PRIVACY','OTHER'].map(category=><FeatureActionButton key={category} secondary title={category.replaceAll('_',' ')} disabled={busy} onPress={async()=>{setBusy(true);try{await apiRequest('/ai-output-reports','POST',{kind,outputId,category});setStatus('Report received.');setOpen(false);}catch(e){setStatus((e as Error).message);}finally{setBusy(false);}}}/>)}</>:null}
 {status?<Text accessibilityRole="alert" style={ui.text}>{status}</Text>:null}</View>;
}
