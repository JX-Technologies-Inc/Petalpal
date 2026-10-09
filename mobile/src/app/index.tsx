import { router } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GardenScene from '../components/garden/GardenScene';
import { GardenHud } from '../components/garden/GardenHud';
import { useAuth } from '../services/auth';

export default function HomeScreen() {
  const { session } = useAuth();
  useEffect(() => { void SplashScreen.hideAsync(); }, []);
  if (!session) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}>
    <GardenScene key={session.user.id} initialWaterfallVersion="v2" session={session} gardenOwnerUserId={session.user.id} backendMode showCalendar onOpenBookhouse={() => router.push('/bookhouse')} onOpenReflection={() => router.push('/reflection')} showDevControls={false}>
      <GardenHud />
    </GardenScene>
  </GestureHandlerRootView>;
}
