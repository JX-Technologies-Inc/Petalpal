import { DarkTheme, DefaultTheme, Slot, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { LoginEntranceTransitionHost } from '@/components/auth/LoginEntranceTransitionHost';
import { FeedbackDraftProvider, GlobalHelpFeedback } from '@/components/feedback';
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
        <LoginEntranceTransitionHost>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="player-preview" options={{ animation: 'none' }} />
            <Stack.Screen name="garden-test" />
            <Stack.Screen name="treehouse-test" />
            <Stack.Screen name="swing-test" />
            <Stack.Screen name="moon-bed-test" />
            <Stack.Screen name="water-test" />
            <Stack.Screen name="flower-effects-test" />
            <Stack.Screen name="mailbox" />
            <Stack.Screen name="journal" />
            <Stack.Screen name="login-preview" options={{ animation: 'none' }} />
          </Stack>
        </LoginEntranceTransitionHost>
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

  return (
    <WorldTimeProvider>
      <FeedbackDraftProvider>
        <View style={styles.rootShell}>
          {content}
          <GlobalHelpFeedback />
        </View>
      </FeedbackDraftProvider>
    </WorldTimeProvider>
  );
}

const styles = StyleSheet.create({
  rootShell: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
});
