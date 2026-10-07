import { PanelThemeProvider } from '../components/features/PanelTheme';
import { AuthProvider, useAuth } from "../services/auth";
import { ProductionRouteGate } from "../components/ProductionRouteGate";
import { AuthGate } from "../components/AuthGate";
import { DarkTheme, DefaultTheme, Slot, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { WorldTimeProvider } from '@/components/garden/world-time';

SplashScreen.preventAutoHideAsync();

export default function Layout() {
  return <AuthProvider><AuthGate><RoutedContent /></AuthGate></AuthProvider>;
}

function RoutedContent() {
  const pathname = usePathname();
  return <ProductionRouteGate pathname={pathname}><TabLayout /></ProductionRouteGate>;
}

function TabLayout() {
  const { session } = useAuth();
  const colorScheme = useColorScheme();
  const pathname = usePathname();

  // DEV previews need a stable parent navigator outside NativeTabs' route list.
  // Functional Garden routes also need this navigator in exported builds.
  // Other existing preview/tab routes retain their current presentation.
  let content;
  if (__DEV__ || pathname === '/' || pathname === '/journal' || pathname === '/garden-history' || pathname === '/bookhouse' || pathname === '/reflection' || pathname.startsWith('/feature/') || pathname.startsWith('/visit/')) {
    content = (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Garden', headerShown: false }} />
          <Stack.Screen name="reflection" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="bookhouse" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="journal" options={{ title: 'Events / Flowers' }} />
          <Stack.Screen name="garden-history" options={{ title: 'Garden history' }} />
          <Stack.Screen name="feature/[feature]" options={{ title: 'PetalPal' }} />
          <Stack.Screen name="visit/[ownerId]" options={{ title: 'Friend Garden', headerShown: false }} />
          <Stack.Screen name="garden-test" options={{ title: 'Garden preview' }} />
          {__DEV__ && <Stack.Screen name="treehouse-test" options={{ title: 'Treehouse preview' }} />}
          {__DEV__ && <Stack.Screen name="swing-test" options={{ title: 'Swing preview' }} />}
          {__DEV__ && <Stack.Screen name="moon-bed-test" options={{ title: 'Moon Bed preview' }} />}
          {__DEV__ && <Stack.Screen name="water-test" options={{ title: 'Water preview' }} />}
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

  return <PanelThemeProvider key={session?.user.id} userId={session?.user.id}><WorldTimeProvider key={session?.user.id}>{content}</WorldTimeProvider></PanelThemeProvider>;
}
