// CanvasKit must exist before Expo Router evaluates routes with Skia shaders.
// Native keeps the normal synchronous entry and does not load WASM.
import './bootstrap';
