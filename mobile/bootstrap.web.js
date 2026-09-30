import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';
import { configureGardenWebCanvasCache } from './src/components/garden/webCanvasCache';

LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' })
  .then(() => {
    configureGardenWebCanvasCache(globalThis.CanvasKit);
    return require('expo-router/entry');
  })
  .catch(error => console.error('Garden graphics initialization failed', error));
