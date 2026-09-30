type NativeHandle = { delete(): void; isDeleted(): boolean };
type NativeOwner = { ref: NativeHandle };
type HandleRegistry = {
  register(owner: object, handle: NativeHandle, token: object): void;
  unregister(token: object): boolean;
};
type RegistryFactory = (release: (handle: NativeHandle) => void) => HandleRegistry;
type Method = (this: NativeOwner, ...args: unknown[]) => unknown;
const configured = new WeakSet<object>();
const rootsConfigured = new WeakSet<object>();

type ImageNode = { props?: { image?: unknown }; children?: ImageNode[] };
type GardenRoot = { container: {
  nativeId: number; root: ImageNode[]; unmounted?: boolean;
  mapperId?: number | null; redraw?(): void;
} };

// GC can lag behind a rapid re-login. Release Garden's drawn image handles only
// after the pinned Web reconciler confirms its root has completely unmounted.
// This leaves route blur, mounted trees and unrelated canvases untouched.
export function configureGardenWebRootCleanup(
  prototype: { unmount(this: GardenRoot): Promise<unknown> },
  isGarden: (nativeId: number) => boolean,
) {
  if (rootsConfigured.has(prototype)) return;
  rootsConfigured.add(prototype);
  const unmount = prototype.unmount;
  prototype.unmount = function () {
    if (!isGarden(this.container.nativeId)) return unmount.call(this);
    const handles = new Set<NativeHandle>();
    const visit = (nodes: ImageNode[]) => {
      for (const node of nodes) {
        const image = node.props?.image as { __typename__?: string; ref?: NativeHandle } | undefined;
        if (image?.__typename__ === 'Image' && image.ref) handles.add(image.ref);
        if (node.children) visit(node.children);
      }
    };
    visit(this.container.root);
    const result = unmount.call(this);
    // 2.6.2's Container.unmount only sets a flag. ReanimatedContainer.redraw
    // stops its mapper before checking that flag, without recording a picture.
    // Stop it now so no scheduled animation replay can use retired image refs.
    if (this.container.unmounted && 'mapperId' in this.container) this.container.redraw?.();
    return result.then(result => {
      for (const handle of handles) if (!handle.isDeleted()) handle.delete();
      handles.clear();
      return result;
    });
  };
}

// Skia 2.6.2 Web HostObjects do not finalize their Embind handles. Garden
// replay creates temporary paints, clip paths, shaders and filters every frame;
// useImage also leaves decoded native images alive after its JS owner unmounts.
// Tie each native handle to its JS owner's lifetime, keeping pooled/live objects
// alive. Native paints/pictures retain their own references to shader/filter data.
// This shim is installed only by the Web bootstrap; native Skia is untouched.
export function configureGardenWebNativeOwnership(
  paintPrototype: object,
  factories: ReadonlyArray<readonly [unknown, readonly string[]]>,
  makeRegistry?: RegistryFactory,
) {
  if (configured.has(paintPrototype)) return;
  if (!makeRegistry && typeof FinalizationRegistry === 'undefined') return;
  configured.add(paintPrototype);
  const registry = (makeRegistry ?? (release => new FinalizationRegistry(release)))(handle => {
    if (!handle.isDeleted()) handle.delete();
  });
  const own = (value: unknown) => {
    const owner = value as NativeOwner | null;
    if (owner?.ref && typeof owner.ref.delete === 'function' && typeof owner.ref.isDeleted === 'function') {
      registry.unregister(owner);
      registry.register(owner, owner.ref, owner);
    }
    return value;
  };
  const prototype = paintPrototype as Record<string, Method>;
  for (const name of ['assign', 'reset']) {
    const original = prototype[name];
    if (typeof original !== 'function') continue;
    prototype[name] = function (...args) {
      const previous = this.ref;
      const result = original.apply(this, args);
      // assign/reset replace ref in 2.6.2 without deleting the old native Paint.
      // Transfer ownership only after success; failed calls retain the old ref.
      if (previous !== this.ref) {
        registry.unregister(this);
        if (!previous.isDeleted()) previous.delete();
        own(this);
      }
      return result;
    };
  }
  for (const [value, names] of factories) {
    if (!value || typeof value !== 'object') continue;
    const factory = value as Record<string, Method>;
    for (const name of names) {
      const original = factory[name];
      if (typeof original !== 'function') continue;
      factory[name] = function (...args) {
        return own(original.apply(this, args));
      };
    }
  }
}
