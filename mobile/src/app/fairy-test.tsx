import {Redirect,Stack} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {useEffect} from 'react';
import FairyTestScene from '@/components/fairy/FairyTestScene';

export default function FairyTestRoute() {
  useEffect(()=>{if(__DEV__)void SplashScreen.hideAsync();},[]);
  if(!__DEV__)return <Redirect href="/"/>;
  return <><Stack.Screen options={{title:'Fairy runtime test'}}/><FairyTestScene/></>;
}
