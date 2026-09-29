import { DarkTheme, DefaultTheme, Slot, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { WorldTimeProvider } from '@/components/garden/world-time';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  // DEV previews need a stable parent navigator outside NativeTabs' route list.
  // Production keeps the existing tab flow; development still starts at Home.
  let content;
  if (__DEV__) {
    content = (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Home' }} />
          <Stack.Screen name="garden-test" options={{ title: 'Garden preview' }} />
          <Stack.Screen name="treehouse-test" options={{ title: 'Treehouse preview' }} />
          <Stack.Screen name="swing-test" options={{ title: 'Swing preview' }} />
          <Stack.Screen name="moon-bed-test" options={{ title: 'Moon Bed preview' }} />
          <Stack.Screen name="water-test" options={{ title: 'Water preview' }} />
        </Stack>
      </ThemeProvider>
    );
  } else if (pathname === '/treehouse-test') {
    content = <Slot />;
  } else {
    content = (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    );
  }

  return <WorldTimeProvider>{content}</WorldTimeProvider>;
}
