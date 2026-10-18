import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsHostedByLoginTransition } from '@/components/auth/LoginEntranceTransitionHost';
import GardenExperience from '@/components/garden/GardenExperience';

export default function PlayerPreviewScreen() {
  const isHosted = useIsHostedByLoginTransition();

  useEffect(() => {
    if (__DEV__) void SplashScreen.hideAsync();
  }, []);

  if (!__DEV__) return <Redirect href="/" />;
  if (isHosted) {
    return <View style={styles.placeholder} pointerEvents="none" />;
  }

  return <GardenExperience mode="player" />;
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#5AA4AB',
  },
});
