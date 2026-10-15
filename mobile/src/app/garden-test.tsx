import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import GardenExperience from '@/components/garden/GardenExperience';

export default function GardenTestScreen() {
  useEffect(() => {
    if (__DEV__) void SplashScreen.hideAsync();
  }, []);

  if (!__DEV__) return <Redirect href="/" />;

  return <GardenExperience mode="development" />;
}
