import type { CanvasKit, Surface } from 'canvaskit-wasm';
import { JsiSkImage } from '@shopify/react-native-skia/lib/module/skia/web/JsiSkImage';
import type { SkRect, SkPicture } from '@shopify/react-native-skia';
import { backingSize, type GardenQuality, type QualitySignals } from './gardenRenderQuality';

// Garden-only replacement for Skia 2.6.2's import-time DPR renderer.
// Images/pictures stay in the existing Skia reconciler and ownership cleanup.
export class GardenWebRenderer {
  private surface: Surface | null = null;
  private disposed = false;
  private scaleX = 1;
  private scaleY = 1;
  constructor(private kit: CanvasKit, private canvas: HTMLCanvasElement) {}
  resize(tier: GardenQuality, signals: QualitySignals) {
    if (this.disposed || !signals.width || !signals.height) return false;
    const size = backingSize(tier, signals);
    if (this.surface && this.canvas.width === size.width && this.canvas.height === size.height) return false;
    this.surface?.delete();
    this.surface = null;
    this.canvas.width = size.width;
    this.canvas.height = size.height;
    this.scaleX = size.width / signals.width;
    this.scaleY = size.height / signals.height;
    this.surface = this.kit.MakeWebGLCanvasSurface(this.canvas);
    const context = this.canvas.getContext('webgl2');
    if (context) context.drawingBufferColorSpace = 'display-p3';
    if (!this.surface) throw new Error('Could not create Garden surface');
    return true;
  }
  draw(picture: SkPicture) {
    if (!this.surface) return false;
    const canvas = this.surface.getCanvas();
    canvas.clear(this.kit.TRANSPARENT);
    canvas.save();
    try {
      canvas.scale(this.scaleX, this.scaleY);
      // Same recorded picture, sampling and source pixels in every tier.
      canvas.drawPicture((picture as SkPicture & { ref: Parameters<typeof canvas.drawPicture>[0] }).ref);
    } finally { canvas.restore(); }
    this.surface.flush();
    return true;
  }
  makeImageSnapshot(rect?: SkRect) {
    if (!this.surface) throw new Error('Garden surface is unavailable');
    const bounds = rect ? [Math.round(rect.x * this.scaleX), Math.round(rect.y * this.scaleY),
      Math.round((rect.x + rect.width) * this.scaleX), Math.round((rect.y + rect.height) * this.scaleY)] : undefined;
    return new JsiSkImage(this.kit, this.surface.makeImageSnapshot(bounds));
  }
  suspend() {
    // Route/background pause frees GPU textures, retaining the canonical picture/images.
    this.surface?.delete();
    this.surface = null;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.suspend();
    this.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
