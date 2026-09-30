import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb';

LoadSkiaWeb({ locateFile: () => '/canvaskit.wasm' })
  .then(() => require('expo-router/entry'))
  .catch(error => console.error('Garden graphics initialization failed', error));
