import type { SkImage } from '@shopify/react-native-skia';
import type { ReactElement } from 'react';

// Native already records animations on its render thread.
export default function GardenStaticPicture({ children }: { children: ReactElement; images: readonly SkImage[] }) {
  return children;
}
