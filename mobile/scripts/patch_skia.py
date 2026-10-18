import os

# 1. Patch commonjs/sksg/Container.web.js
path = 'mobile/node_modules/@shopify/react-native-skia/lib/commonjs/sksg/Container.web.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

old1 = '''  constructor(Skia, nativeId) {
    super(Skia);
    this.nativeId = nativeId;
    _defineProperty(this, "mapperId", null);
  }
  redraw() {'''
new1 = '''  constructor(Skia, nativeId) {
    super(Skia);
    this.nativeId = nativeId;
    _defineProperty(this, "mapperId", null);
  }
  unmount() {
    super.unmount();
    if (this.mapperId !== null) {
      _ReanimatedProxy.default.stopMapper(this.mapperId);
      this.mapperId = null;
    }
  }
  redraw() {'''
if old1 in c:
    c = c.replace(old1, new1)

old2 = '''const drawOnscreen = (Skia, nativeId, recording) => {
  "worklet";

  const rec = Skia.PictureRecorder();'''
new2 = '''const drawOnscreen = (Skia, nativeId, recording) => {
  "worklet";

  if (globalThis.SkiaViewApi && !globalThis.SkiaViewApi.views[`${nativeId}`]) {
    return;
  }
  const rec = Skia.PictureRecorder();'''
if old2 in c:
    c = c.replace(old2, new2)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched commonjs Container.web.js')

# 2. Patch module/sksg/Container.web.js
path_mod = 'mobile/node_modules/@shopify/react-native-skia/lib/module/sksg/Container.web.js'
with open(path_mod, 'r', encoding='utf-8') as f:
    m = f.read()

old_m1 = '''  constructor(Skia, nativeId) {
    super(Skia);
    this.nativeId = nativeId;
    _defineProperty(this, "mapperId", null);
  }
  redraw() {'''
new_m1 = '''  constructor(Skia, nativeId) {
    super(Skia);
    this.nativeId = nativeId;
    _defineProperty(this, "mapperId", null);
  }
  unmount() {
    super.unmount();
    if (this.mapperId !== null) {
      Rea.stopMapper(this.mapperId);
      this.mapperId = null;
    }
  }
  redraw() {'''
if old_m1 in m:
    m = m.replace(old_m1, new_m1)

old_m2 = '''const drawOnscreen = (Skia, nativeId, recording) => {
  "worklet";

  const rec = Skia.PictureRecorder();'''
new_m2 = '''const drawOnscreen = (Skia, nativeId, recording) => {
  "worklet";

  if (globalThis.SkiaViewApi && !globalThis.SkiaViewApi.views[`${nativeId}`]) {
    return;
  }
  const rec = Skia.PictureRecorder();'''
if old_m2 in m:
    m = m.replace(old_m2, new_m2)

with open(path_mod, 'w', encoding='utf-8') as f:
    f.write(m)
print('Patched module Container.web.js')

# 3. Patch NativeSkiaModule.web.js (both commonjs and module)
for p in ['mobile/node_modules/@shopify/react-native-skia/lib/commonjs/specs/NativeSkiaModule.web.js',
          'mobile/node_modules/@shopify/react-native-skia/lib/module/specs/NativeSkiaModule.web.js']:
    with open(p, 'r', encoding='utf-8') as f:
        ns = f.read()
    old_ns = '''    if (name === "picture") {
      if (!this.views[`${nativeId}`]) {
        this.deferedPictures[`${nativeId}`] = value;
      } else {
        this.views[`${nativeId}`].setPicture(value);
      }
    }'''
    new_ns = '''    if (name === "picture") {
      if (!this.views[`${nativeId}`]) {
        try { value?.dispose?.(); } catch {}
      } else {
        this.views[`${nativeId}`].setPicture(value);
      }
    }'''
    if old_ns in ns:
        ns = ns.replace(old_ns, new_ns)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(ns)
        print('Patched', p)

# 4. Patch SkiaPictureView.web.js (both commonjs and module)
for p in ['mobile/node_modules/@shopify/react-native-skia/lib/commonjs/views/SkiaPictureView.web.js',
          'mobile/node_modules/@shopify/react-native-skia/lib/module/views/SkiaPictureView.web.js']:
    with open(p, 'r', encoding='utf-8') as f:
        pv = f.read()
    old_set_cjs = '''  const setPicture = (0, _react.useCallback)(newPicture => {
    pictureRef.current = newPicture;
    redraw();
  }, [redraw]);'''
    new_set_cjs = '''  const setPicture = (0, _react.useCallback)(newPicture => {
    if (pictureRef.current && pictureRef.current !== newPicture) {
      try { pictureRef.current.dispose(); } catch {}
    }
    pictureRef.current = newPicture;
    redraw();
  }, [redraw]);'''
    if old_set_cjs in pv:
        pv = pv.replace(old_set_cjs, new_set_cjs)

    old_set_esm = '''  const setPicture = useCallback(newPicture => {
    pictureRef.current = newPicture;
    redraw();
  }, [redraw]);'''
    new_set_esm = '''  const setPicture = useCallback(newPicture => {
    if (pictureRef.current && pictureRef.current !== newPicture) {
      try { pictureRef.current.dispose(); } catch {}
    }
    pictureRef.current = newPicture;
    redraw();
  }, [redraw]);'''
    if old_set_esm in pv:
        pv = pv.replace(old_set_esm, new_set_esm)

    # unregister on unmount
    old_reg_cjs = '''    global.SkiaViewApi.registerView(nativeID, {
      setPicture,
      getSize,
      redraw,
      makeImageSnapshot,
      measure,
      measureInWindow
    });
  }, [setPicture, getSize, redraw, makeImageSnapshot, measure, measureInWindow, props.nativeID]);'''
    new_reg_cjs = '''    global.SkiaViewApi.registerView(nativeID, {
      setPicture,
      getSize,
      redraw,
      makeImageSnapshot,
      measure,
      measureInWindow
    });
    return () => {
      delete global.SkiaViewApi.views[nativeID];
      if (global.SkiaViewApi.deferedPictures && global.SkiaViewApi.deferedPictures[nativeID]) {
        try { global.SkiaViewApi.deferedPictures[nativeID].dispose?.(); } catch {}
        delete global.SkiaViewApi.deferedPictures[nativeID];
      }
    };
  }, [setPicture, getSize, redraw, makeImageSnapshot, measure, measureInWindow, props.nativeID]);'''
    if old_reg_cjs in pv:
        pv = pv.replace(old_reg_cjs, new_reg_cjs)

    old_reg_esm = '''    global.SkiaViewApi.registerView(nativeID, {
      setPicture,
      getSize,
      redraw,
      makeImageSnapshot,
      measure,
      measureInWindow
    });
  }, [setPicture, getSize, redraw, makeImageSnapshot, measure, measureInWindow, props.nativeID]);'''
    if old_reg_esm in pv:
        pv = pv.replace(old_reg_esm, new_reg_cjs)

    with open(p, 'w', encoding='utf-8') as f:
        f.write(pv)
    print('Patched', p)

# 5. Patch Data.js (both commonjs and module) with static asset caching
path_cjs = 'mobile/node_modules/@shopify/react-native-skia/lib/commonjs/skia/core/Data.js'
with open(path_cjs, 'r', encoding='utf-8') as f:
    c = f.read()

old_cjs = """const loadData = (source, factory, onError) => {
  if (source === null || source === undefined) {
    return new Promise(resolve => resolve(null));
  } else if (source instanceof Uint8Array) {
    return new Promise(resolve => resolve(factoryWrapper(_Skia.Skia.Data.fromBytes(source), factory, onError)));
  } else {
    const uri = typeof source === "string" ? source : _Platform.Platform.resolveAsset(source);
    return _Skia.Skia.Data.fromURI(uri).then(d => factoryWrapper(d, factory, onError));
  }
};"""

new_cjs = """const assetDataCache = new Map();
const loadData = (source, factory, onError) => {
  if (source === null || source === undefined) {
    return Promise.resolve(null);
  } else if (source instanceof Uint8Array) {
    return Promise.resolve(factoryWrapper(_Skia.Skia.Data.fromBytes(source), factory, onError));
  } else {
    const uri = typeof source === "string" ? source : _Platform.Platform.resolveAsset(source);
    if (uri && assetDataCache.has(uri)) {
      return assetDataCache.get(uri);
    }
    const p = _Skia.Skia.Data.fromURI(uri).then(d => {
      const res = factoryWrapper(d, factory, onError);
      if (!res && uri) assetDataCache.delete(uri);
      return res;
    }).catch(err => {
      if (uri) assetDataCache.delete(uri);
      onError && onError(err);
      return null;
    });
    if (uri) assetDataCache.set(uri, p);
    return p;
  }
};"""

if old_cjs in c:
    c = c.replace(old_cjs, new_cjs)
    with open(path_cjs, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Patched commonjs Data.js')

path_esm = 'mobile/node_modules/@shopify/react-native-skia/lib/module/skia/core/Data.js'
with open(path_esm, 'r', encoding='utf-8') as f:
    m = f.read()

old_esm = """const loadData = (source, factory, onError) => {
  if (source === null || source === undefined) {
    return new Promise(resolve => resolve(null));
  } else if (source instanceof Uint8Array) {
    return new Promise(resolve => resolve(factoryWrapper(Skia.Data.fromBytes(source), factory, onError)));
  } else {
    const uri = typeof source === "string" ? source : Platform.resolveAsset(source);
    return Skia.Data.fromURI(uri).then(d => factoryWrapper(d, factory, onError));
  }
};"""

new_esm = """const assetDataCache = new Map();
const loadData = (source, factory, onError) => {
  if (source === null || source === undefined) {
    return Promise.resolve(null);
  } else if (source instanceof Uint8Array) {
    return Promise.resolve(factoryWrapper(Skia.Data.fromBytes(source), factory, onError));
  } else {
    const uri = typeof source === "string" ? source : Platform.resolveAsset(source);
    if (uri && assetDataCache.has(uri)) {
      return assetDataCache.get(uri);
    }
    const p = Skia.Data.fromURI(uri).then(d => {
      const res = factoryWrapper(d, factory, onError);
      if (!res && uri) assetDataCache.delete(uri);
      return res;
    }).catch(err => {
      if (uri) assetDataCache.delete(uri);
      onError && onError(err);
      return null;
    });
    if (uri) assetDataCache.set(uri, p);
    return p;
  }
};"""

if old_esm in m:
    m = m.replace(old_esm, new_esm)
    with open(path_esm, 'w', encoding='utf-8') as f:
        f.write(m)
    print('Patched module Data.js')

print('All patches applied successfully!')
