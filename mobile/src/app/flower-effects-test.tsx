import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import FlowerEffectsPreview from '@/components/garden/flower-mood-effects/FlowerEffectsPreview';

export default function FlowerEffectsTestScreen() {
  useEffect(() => {
    if (__DEV__) void SplashScreen.hideAsync();
  }, []);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <FlowerEffectsPreview />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1C2620',
  },
});
