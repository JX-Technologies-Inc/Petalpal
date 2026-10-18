import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { LoginPreviewPage } from '@/components/auth/LoginPreviewPage';
import { useIsHostedByLoginTransition } from '@/components/auth/LoginEntranceTransitionHost';

/**
 * Standalone PetalPal Login Preview Route (/login-preview)
 *
 * Isolated screen built to review the approved invitation-style login UI and interactions,
 * and seamlessly transition into the live Player Garden (/player-preview) on DEV login success.
 */
export default function LoginPreviewRoute() {
  const isHosted = useIsHostedByLoginTransition();
  if (!__DEV__) return <Redirect href="/" />;
  if (isHosted) {
    return <View style={styles.placeholder} />;
  }
  return <LoginPreviewPage />;
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#5AA4AB',
  },
});
