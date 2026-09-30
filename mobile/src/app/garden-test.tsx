import { useAuth } from '../services/auth';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GardenScene from '@/components/garden/GardenScene';
import FlowerDensitySandbox from '@/components/garden/flower-density-sandbox/FlowerDensitySandbox';
import ProductionGrowthQA from '@/components/garden/planting/ProductionGrowthQA';

export default function GardenTestScreen() {
  const { session } = useAuth();
  const [showDensitySandbox, setShowDensitySandbox] = useState(false);
  const [showProductionQA,setShowProductionQA]=useState(false);
  useEffect(() => { if (__DEV__) void SplashScreen.hideAsync(); }, []);
  if (!session) return null;
  if (showProductionQA) return <GestureHandlerRootView style={styles.root}><ProductionGrowthQA onClose={()=>setShowProductionQA(false)}/></GestureHandlerRootView>;
  return <GestureHandlerRootView style={styles.root}>
    {showDensitySandbox ? <FlowerDensitySandbox onClose={() => setShowDensitySandbox(false)} /> : <>
      <GardenScene initialWaterfallVersion="v2" session={session} backendMode />
      {__DEV__ && <Pressable accessibilityRole="button" style={styles.sandboxButton} onPress={() => setShowDensitySandbox(true)}>
        <Text style={styles.sandboxLabel}>Flower Density Sandbox</Text>
      </Pressable>}
      {__DEV__ && <Pressable accessibilityRole="button" style={[styles.sandboxButton,{top:58}]} onPress={()=>setShowProductionQA(true)}>
        <Text style={styles.sandboxLabel}>Production Growth QA</Text>
      </Pressable>}
    </>}
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sandboxButton: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 14, paddingVertical: 11,
    backgroundColor: '#365b42', borderRadius: 8, borderWidth: 1, borderColor: '#e3edda', zIndex: 20 },
  sandboxLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
