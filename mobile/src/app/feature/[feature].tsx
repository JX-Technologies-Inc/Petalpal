import { Redirect, useLocalSearchParams } from 'expo-router';

export default function FeatureScreen() {
  const { feature } = useLocalSearchParams<{ feature: string }>();
  return <Redirect href={{ pathname: '/', params: { feature } }} />;
}
