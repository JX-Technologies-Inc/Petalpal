import { Redirect, useLocalSearchParams } from 'expo-router';
import GardenTestScreen from '../garden-test';

export default function FeatureScreen() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
  if (feature === 'fairy') return <GardenTestScreen />;
  return <Redirect href={{ pathname: '/', params: { feature } }} />;
}
