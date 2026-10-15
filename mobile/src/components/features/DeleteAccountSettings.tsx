import {useState} from 'react';
import {Text,View} from 'react-native';
import {useAuth} from '../../services/auth';
import {FeatureActionButton,ui} from './FeatureUI';
export function DeleteAccountSettings(){
 const {deleteAccount}=useAuth();const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <View style={{gap:10}}><Text accessibilityRole="header" style={ui.title}>Delete Account</Text>
 <Text style={ui.text}>Delete your account, private Journals and photos, Events, memories, embeddings, reflections, Garden and social content. This cannot be undone. Minimal security/cost records, deletion retry records, backups and provider copies may remain under their retention policies. Other people’s copies cannot be recalled.</Text>
 <FeatureActionButton secondary title="Delete Account" disabled={busy} onPress={()=>setConfirm(true)}/>
 {confirm?<><Text style={ui.text}>Confirm permanent deletion. You must have signed in within the last five minutes. If asked, sign out and sign in again, then return here. A network failure may require retrying or contacting support.</Text>
 <FeatureActionButton title={busy?'Deleting…':'Permanently delete my account'} disabled={busy} onPress={async()=>{setBusy(true);setError('');try{await deleteAccount();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}/>
 <FeatureActionButton secondary title="Cancel deletion" disabled={busy} onPress={()=>setConfirm(false)}/></>:null}
 {error?<Text accessibilityRole="alert" style={ui.text}>{error}</Text>:null}</View>;
}
