import type { CanvasKit, ColorSpace, GrDirectContext, Surface } from 'canvaskit-wasm';

// The unchanged Garden uses ~542 MiB in development, ~260 MiB in release.
// Its 256 MiB default evicts/reuploads them on every idle animation frame.
// This is a demand-filled ceiling, not an allocation or an image-retention cache.
export const GARDEN_WEB_TEXTURE_CACHE_BYTES = 640 * 1024 * 1024;

type WebCanvasKit = CanvasKit & {
  // CanvasKit's WebGL registry cleanup (present in the bundled runtime).
  deleteContext(handle: number): void;
};

type FramePicture = { ref: object & { isDeleted(): boolean }; dispose(): void };
type WebViewApi = {
  views: Record<string, unknown>;
  deferedPictures: Record<string, unknown>;
  deferedOnSize: Record<string, unknown>;
  setJsiProperty(id: number, name: string, value: unknown): void;
};

export function configureGardenWebCanvasCache(kit: WebCanvasKit,
  readViewApi = () => (globalThis as unknown as { SkiaViewApi?: WebViewApi }).SkiaViewApi) {
  const makeContext = kit.MakeWebGLContext;
  const makeSurface = kit.MakeWebGLCanvasSurface;
  type Owner = { context?: GrDirectContext; handle?: number; surface?: Surface;
    width?: number; height?: number; viewId?: string; retire?: (final: boolean) => void };
  const owners = new WeakMap<object, Owner>();
  let creating: Owner | undefined;
  let viewApi: WebViewApi | undefined;
  const pictures = new Map<string, FramePicture>();
  const pictureIds = new WeakMap<object, string>();
  const viewOwners = new Map<string, Owner>();
  const disposePicture = (picture?: FramePicture) => {
    if (picture && !picture.ref.isDeleted()) picture.dispose();
  };
  const installPictureOwnership = () => {
    const api = readViewApi();
    if (!api || api === viewApi) return;
    viewApi = api;
    const setProperty = api.setJsiProperty;
    api.setJsiProperty = function (id, name, value) {
      setProperty.call(this, id, name, value);
      if (name !== 'picture' || !value) return;
      const picture = value as FramePicture;
      const key = String(id), previous = pictures.get(key);
      if (api.views[key]) delete api.deferedPictures[key];
      pictures.set(key, picture);
      pictureIds.set(picture.ref, key);
      // Only own frame pictures actually drawn on one of our Web surfaces.
      // Skia 2.6.2 replaces these without disposing them; GC is nondeterministic.
      // Cached child pictures remain referenced by the new frame's recording.
      if (viewOwners.has(key) && previous?.ref !== picture.ref) disposePicture(previous);
    };
  };
  kit.MakeWebGLContext = function (handle) {
    const context = makeContext.call(this, handle);
    context?.setResourceCacheLimitBytes(GARDEN_WEB_TEXTURE_CACHE_BYTES);
    if (creating && context) Object.assign(creating, { context, handle });
    return context;
  };

  // A layout replaces the framebuffer surface, not the canvas's WebGL context.
  // Retained pictures/images must keep the same context through hidden layouts.
  // Destroy the context only when Skia actually disposes the current surface.
  kit.MakeWebGLCanvasSurface = function (canvas, colorSpace, options) {
    installPictureOwnership();
    const target = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    const owner: Owner = (target && owners.get(target)) || {};
    const backing = target as HTMLCanvasElement | OffscreenCanvas | null;
    // Stack blur reports zero backing size, then the same size on return.
    // Keep that surface too: no zero-size native surface or repeated uploads.
    if (owner.surface && backing && (backing.width === 0 || backing.height === 0
      || (backing.width === owner.width && backing.height === owner.height))) return owner.surface;
    owner.retire?.(false);
    const release = () => {
      if (owner.viewId) {
        const id = owner.viewId;
        disposePicture(pictures.get(id));
        pictures.delete(id); viewOwners.delete(id);
        if (viewApi) {
          delete viewApi.views[id];
          delete viewApi.deferedPictures[id];
          delete viewApi.deferedOnSize[id];
        }
      }
      try { owner.context?.delete(); } finally {
        if (owner.handle !== undefined) kit.deleteContext(owner.handle);
        if (target) owners.delete(target);
      }
    };
    const previous = creating;
    creating = owner;
    let surface: Surface | null;
    try {
      if (owner.context && backing) {
        // Keep the bounded texture cache through route blur. Purging it on
        // zero layouts repeatedly decodes/uploads retained images on return.
        // Preserve CanvasKit's helper default (null), color space and physical
        // backing dimensions. CSS sizing and Garden's logical fit are untouched.
        surface = kit.MakeOnScreenGLSurface(owner.context, backing.width, backing.height,
          (colorSpace ?? null) as ColorSpace);
      } else {
        surface = makeSurface.call(this, canvas, colorSpace, options);
      }
    } catch (error) {
      release();
      throw error;
    } finally {
      creating = previous;
    }
    if (!surface) {
      release();
      return surface;
    }
    if (surface.getCanvas) {
      const getCanvas = surface.getCanvas.bind(surface);
      const wrapped = new WeakSet<object>();
      surface.getCanvas = () => {
        const nativeCanvas = getCanvas();
        if (!wrapped.has(nativeCanvas)) {
          wrapped.add(nativeCanvas);
          const drawPicture = nativeCanvas.drawPicture;
          nativeCanvas.drawPicture = function (picture) {
            const id = pictureIds.get(picture);
            if (id) { owner.viewId = id; viewOwners.set(id, owner); }
            drawPicture.call(this, picture);
          };
        }
        return nativeCanvas;
      };
    }
    const dispose = surface.delete.bind(surface);
    let deleted = false;
    const retire = (final: boolean) => {
      if (deleted) return;
      deleted = true;
      try { dispose(); } finally { if (final) release(); }
    };
    Object.assign(owner, { surface, width: backing?.width, height: backing?.height, retire });
    surface.delete = () => retire(true);
    if (target) owners.set(target, owner);
    return surface;
  };
}


type NativePaint = { copy(): NativePaint; delete(): void; isDeleted(): boolean };
type WebPaint = { ref: NativePaint; assign(source: WebPaint): void; reset(): void;
  copy(): WebPaint; dispose(): void };

// Skia 2.6.2 overwrites raw (non-smart-pointer) SkPaint handles in assign/reset.
// Retire those immediately and finalize temporary outer JsiSkPaint wrappers.
export function configureGardenWebPaintResources(kit: { Paint: new () => NativePaint },
  skia: { Paint(): WebPaint }) {
  const release = (ref: NativePaint) => { if (!ref.isDeleted()) ref.delete(); };
  const finalizer = new FinalizationRegistry<NativePaint>(release);
  const own = (paint: WebPaint) => { finalizer.register(paint, paint.ref, paint); return paint; };
  const makePaint = skia.Paint;
  const sample = makePaint.call(skia);
  const prototype = Object.getPrototypeOf(sample) as WebPaint;
  sample.dispose();
  const replace = (paint: WebPaint, ref: NativePaint) => {
    finalizer.unregister(paint);
    const previous = paint.ref;
    paint.ref = ref;
    release(previous);
    own(paint);
  };
  prototype.assign = function (source) { replace(this, source.ref.copy()); };
  prototype.reset = function () { replace(this, new kit.Paint()); };
  const copy = prototype.copy;
  prototype.copy = function () { return own(copy.call(this)); };
  skia.Paint = function () { return own(makePaint.call(this)); };
}
