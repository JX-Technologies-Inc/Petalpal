import {Redirect,Stack} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {useEffect} from 'react';
import FairySwingTestScene from '@/components/fairy/FairySwingTestScene';

export default function FairySwingTestRoute() {
  useEffect(()=>{if(__DEV__)void SplashScreen.hideAsync();},[]);
  if(!__DEV__)return <Redirect href="/"/>;
  return <><Stack.Screen options={{title:'Fairy Swing interaction'}}/><FairySwingTestScene/></>;
}
