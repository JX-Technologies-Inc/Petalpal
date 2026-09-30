import { Canvas } from '@shopify/react-native-skia';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TreehouseEntity, {
  TREEHOUSE_HEIGHT,
  TREEHOUSE_WIDTH,
  TREEHOUSE_LAYER_NAMES,
  type TreehouseDebugMode,
} from '@/components/garden/TreehouseEntity';

// Adjust this multiplier for visual testing; 1 fits the complete artwork.
const TREEHOUSE_TEST_SCALE = 0.9;

export default function TreehouseTestScreen() {
  const insets = useSafeAreaInsets();
  const [debugMode, setDebugMode] = useState<TreehouseDebugMode>('all');
  const [debugStatus, setDebugStatus] = useState('Waiting for Canvas');
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [lightingEnabled, setLightingEnabled] = useState(true);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const scale = Math.min(
    viewport.width / TREEHOUSE_WIDTH,
    viewport.height / TREEHOUSE_HEIGHT,
  ) * TREEHOUSE_TEST_SCALE;

  useEffect(() => {
    // This isolated route deliberately bypasses the starter's animated splash.
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View
      style={styles.container}
      onLayout={({ nativeEvent: { layout } }) => {
        setViewport({ width: layout.width, height: layout.height });
      }}>
      {viewport.width > 0 && viewport.height > 0 && (
        <Canvas style={styles.canvas}>
          <TreehouseEntity
            x={(viewport.width - TREEHOUSE_WIDTH * scale) / 2}
            y={(viewport.height - TREEHOUSE_HEIGHT * scale) / 2}
            scale={scale}
            debugMode={__DEV__ ? debugMode : 'all'}
            onDebugStatus={__DEV__ ? setDebugStatus : undefined}
            animationEnabled={__DEV__ && animationEnabled}
            lightingEnabled={__DEV__ && lightingEnabled}
          />
        </Canvas>
      )}
      {__DEV__ && (
        <View style={[styles.debugPanel, { top: insets.top + 8 }]}>
          <Text style={styles.debugText}>DEV layers — {debugMode}</Text>
          <View style={styles.debugButtons}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Treehouse animation"
              accessibilityState={{ checked: animationEnabled }}
              onPress={() => setAnimationEnabled((enabled) => !enabled)}
              style={[styles.debugButton, animationEnabled && styles.selectedButton]}>
              <Text style={styles.debugText}>Animation {animationEnabled ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Localized Treehouse lighting"
              accessibilityState={{ checked: lightingEnabled }}
              onPress={() => setLightingEnabled((enabled) => !enabled)}
              style={[styles.debugButton, lightingEnabled && styles.selectedButton]}>
              <Text style={styles.debugText}>Lighting {lightingEnabled ? 'ON' : 'OFF'}</Text>
            </Pressable>
            {(['all', ...TREEHOUSE_LAYER_NAMES] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: debugMode === mode }}
                onPress={() => setDebugMode(mode)}
                style={[styles.debugButton, debugMode === mode && styles.selectedButton]}>
                <Text style={styles.debugText}>{mode}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.debugText}>{debugStatus}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  debugPanel: {
    position: 'absolute', left: 8, right: 8, padding: 8,
    backgroundColor: '#FFFFFF', borderRadius: 8,
  },
  debugButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 6 },
  debugButton: { padding: 6, backgroundColor: '#E5E7EB', borderRadius: 4 },
  selectedButton: { backgroundColor: '#A7D6AF' },
  debugText: { fontSize: 11, color: '#172219' },
  container: {
    flex: 1,
    backgroundColor: '#D8DDD8',
  },
  canvas: {
    flex: 1,
  },
});
