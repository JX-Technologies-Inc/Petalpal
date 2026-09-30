import type { CanvasKit, GrDirectContext, Surface } from 'canvaskit-wasm';

// The unchanged Garden uses ~542 MiB in development, ~260 MiB in release.
// Its 256 MiB default evicts/reuploads them on every idle animation frame.
// This is a demand-filled ceiling, not an allocation or an image-retention cache.
export const GARDEN_WEB_TEXTURE_CACHE_BYTES = 640 * 1024 * 1024;

type WebCanvasKit = CanvasKit & {
  // CanvasKit's WebGL registry cleanup (present in the bundled runtime).
  deleteContext(handle: number): void;
};

export function configureGardenWebCanvasCache(kit: WebCanvasKit) {
  const makeContext = kit.MakeWebGLContext;
  const makeSurface = kit.MakeWebGLCanvasSurface;
  const surfaces = new WeakMap<object, Surface>();
  let creating: { context?: GrDirectContext; handle?: number } | undefined;
  kit.MakeWebGLContext = function (handle) {
    const context = makeContext.call(this, handle);
    context?.setResourceCacheLimitBytes(GARDEN_WEB_TEXTURE_CACHE_BYTES);
    if (creating && context) Object.assign(creating, { context, handle });
    return context;
  };

  // Skia 2.6.2 Web replaces its renderer on every canvas layout, including
  // hidden-route zero layouts, without disposing the old renderer. Own exactly
  // one surface per canvas and release its otherwise orphaned Gr context too.
  kit.MakeWebGLCanvasSurface = function (canvas, colorSpace, options) {
    const target = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    if (target) surfaces.get(target)?.delete();
    const owner: NonNullable<typeof creating> = {};
    const previous = creating;
    creating = owner;
    let surface: Surface | null;
    try {
      surface = makeSurface.call(this, canvas, colorSpace, options);
    } catch (error) {
      owner.context?.delete();
      if (owner.handle !== undefined) kit.deleteContext(owner.handle);
      throw error;
    } finally {
      creating = previous;
    }
    if (!surface) {
      owner.context?.delete();
      if (owner.handle !== undefined) kit.deleteContext(owner.handle);
      return surface;
    }
    const dispose = surface.delete.bind(surface);
    let deleted = false;
    surface.delete = () => {
      if (deleted) return;
      deleted = true;
      try { dispose(); } finally {
        owner.context?.delete();
        if (owner.handle !== undefined) kit.deleteContext(owner.handle);
        if (target && surfaces.get(target) === surface) surfaces.delete(target);
      }
    };
    if (target) surfaces.set(target, surface);
    return surface;
  };
}
