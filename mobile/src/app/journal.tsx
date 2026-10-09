import { Redirect } from 'expo-router';

// Legacy/deep link entry point: open the same temporary panel over Garden.
export default function JournalScreen() {
  return <Redirect href={{ pathname: '/', params: { feature: 'events' } }} />;
}
