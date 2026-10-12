import { Redirect } from 'expo-router';

// Preserve old preview links while keeping one authenticated Garden world.
export default function GardenTestScreen() {
  return <Redirect href="/" />;
}
