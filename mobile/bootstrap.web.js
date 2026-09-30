import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';
import { configureGardenWebCanvasCache, configureGardenWebPaintResources } from './src/components/garden/webCanvasCache';

LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' })
  .then(() => {
    configureGardenWebCanvasCache(globalThis.CanvasKit);
    const { Skia } = require('@shopify/react-native-skia/lib/module/skia/Skia');
    configureGardenWebPaintResources(globalThis.CanvasKit, Skia);
    return require('expo-router/entry');
  })
  .catch(error => console.error('Garden graphics initialization failed', error));
