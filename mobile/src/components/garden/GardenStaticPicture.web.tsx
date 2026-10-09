import { drawAsPicture, Picture, type SkPicture, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState, type ReactElement } from 'react';

/** Cache only static drawing commands, never pixels. Textures, shaders, sampling
 * and camera/DPR remain the same; callers keep asset loading outside this cache. */
export default function GardenStaticPicture({ children, images }: { children: ReactElement; images: readonly SkImage[] }) {
  const [cached, setCached] = useState<{ source: ReactElement; picture: SkPicture } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void drawAsPicture(children, { x: -5000, y: -5000, width: 10000, height: 10000 }).then(picture => {
      if (cancelled) picture.dispose();
      else setCached({ source: children, picture });
    });
    return () => { cancelled = true; };
  }, [children]);
  useEffect(() => {
    if (!cached) return;
    // The owning Skia root has committed the replacement before retiring this
    // JS handle. In-flight parent pictures retain their own native references.
    return () => { requestAnimationFrame(() => cached.picture.dispose()); };
  }, [cached]);
  return cached?.source === children ? <Picture picture={cached.picture} {...{ gardenImageReferences: images }} /> : children;
}
