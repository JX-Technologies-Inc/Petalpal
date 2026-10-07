import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { routeAllowed } from '../services/routePolicy';

// Called inside AuthGate: denied direct links never mount routed children.
export function ProductionRouteGate({ pathname, children, development = __DEV__ }: {
  pathname: string; children: ReactNode; development?: boolean;
}) {
  if (!routeAllowed(pathname, development)) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>This page is unavailable.</Text>
  </View>;
  return children;
}
