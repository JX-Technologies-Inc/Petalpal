type RawPaint = { delete(): void; isDeleted?(): boolean };
type WebPaint = {
  ref: RawPaint;
  assign(paint: WebPaint): void;
  reset(): void;
  copy(): WebPaint;
  dispose(): void;
  [Symbol.dispose](): void;
};
type PaintProvider = { Paint(): unknown };
type Holder = { current: RawPaint | null };
type Lifecycle = { track(paint: WebPaint): WebPaint };

const INSTALLED = Symbol.for('PetalPal.garden.webPaintLifecycle');

function deleteRaw(paint: RawPaint | null) {
  if (paint && !paint.isDeleted?.()) paint.delete();
}

function installWebSkiaViewProtection() {
  const api = (globalThis as any).SkiaViewApi;
  if (!api || api[INSTALLED]) return;
  api[INSTALLED] = true;

  const originalRegisterView = api.registerView;
  const originalSetJsiProperty = api.setJsiProperty;

  api.registerView = function (nativeId: string | number, view: any) {
    if (view && typeof view.setPicture === 'function') {
      const origSetPic = view.setPicture;
      let activePicture: any = null;
      view.setPicture = function (newPic: any) {
        if (activePicture && activePicture !== newPic) {
          try {
            if (activePicture.ref && !activePicture.ref.isDeleted?.()) {
              activePicture.dispose();
            }
          } catch {}
        }
        activePicture = newPic;
        return origSetPic.apply(this, arguments);
      };
    }
    return originalRegisterView.apply(this, arguments);
  };

  api.setJsiProperty = function (nativeId: string | number, name: string, value: any) {
    if (name === 'picture') {
      if (!this.views[`${nativeId}`]) {
        // Target canvas view is unmounted; dispose immediately to prevent WebAssembly heap exhaustion
        try {
          if (value?.ref && !value.ref.isDeleted?.()) {
            value.dispose();
          }
        } catch {}
        return;
      }
    }
    return originalSetJsiProperty.apply(this, arguments);
  };
}

/** Web-only compatibility for the installed Skia raw CanvasKit Paint wrapper.
 * Call behind the app's Platform.OS guard. Native Paint objects are untouched.
 * CanvasKit already finalizes smart-pointer pictures/shaders; Paint is raw.
 */
export function installGardenWebPaintLifecycle(provider: PaintProvider): boolean {
  installWebSkiaViewProtection();

  const skia = provider as { Paint(): WebPaint };
  const originalFactory = skia.Paint;
  if ((originalFactory as unknown as Record<symbol, unknown>)[INSTALLED]) return false;

  const probe = originalFactory.call(skia);
  const prototype = Object.getPrototypeOf(probe) as WebPaint & Record<symbol, unknown>;
  if (!probe.ref || typeof probe.ref.delete !== 'function' ||
      typeof prototype.assign !== 'function' || typeof prototype.reset !== 'function' ||
      typeof prototype.copy !== 'function' || typeof prototype[Symbol.dispose] !== 'function') {
    probe.dispose();
    return false;
  }

  let lifecycle = prototype[INSTALLED] as Lifecycle | undefined;
  if (!lifecycle) {
    const holders = new WeakMap<WebPaint, Holder>();
    const registry = typeof FinalizationRegistry === 'undefined' ? null :
      new FinalizationRegistry<Holder>(holder => {
        // The holder never references its JS owner. Do not touch a destroyed
        // WASM runtime during deferred cleanup after a page/context teardown.
        try { deleteRaw(holder.current); } catch { /* Runtime already torn down. */ }
        holder.current = null;
      });
    const track = (paint: WebPaint) => {
      const existing = holders.get(paint);
      if (existing) existing.current = paint.ref;
      else {
        const holder: Holder = { current: paint.ref };
        holders.set(paint, holder);
        registry?.register(paint, holder, paint);
      }
      return paint;
    };
    const originalAssign = prototype.assign;
    const originalReset = prototype.reset;
    const originalCopy = prototype.copy;
    const originalDispose = prototype[Symbol.dispose];

    prototype.assign = function (paint: WebPaint) {
      const previous = this.ref;
      // Copy first, including self-assignment; retain the SDK's exact behavior.
      originalAssign.call(this, paint);
      track(this);
      if (previous !== this.ref) deleteRaw(previous);
    };
    prototype.reset = function () {
      const previous = this.ref;
      originalReset.call(this);
      track(this);
      if (previous !== this.ref) deleteRaw(previous);
    };
    prototype.copy = function () {
      return track(originalCopy.call(this));
    };
    prototype[Symbol.dispose] = function () {
      const holder = holders.get(this);
      registry?.unregister(this);
      if (holder) holder.current = null;
      holders.delete(this);
      if (!this.ref.isDeleted?.()) originalDispose.call(this);
    };
    lifecycle = { track };
    Object.defineProperty(prototype, INSTALLED, { value: lifecycle });
  }
  probe.dispose();
  const installedLifecycle = lifecycle;
  const factory = function () { return installedLifecycle.track(originalFactory.call(skia)); };
  Object.defineProperty(factory, INSTALLED, { value: installedLifecycle });
  skia.Paint = factory;
  return true;
}
