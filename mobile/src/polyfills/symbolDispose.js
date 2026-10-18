// iOS Safari (2026-10) lacks Symbol.dispose. Skia 2.6.2's Web host objects key
// their cleanup method with Symbol.dispose when their classes load and look it
// up again on dispose(). If the symbol appears later, those keys no longer match
// and every image load fails. Define it once, before Skia loads, like the native one.
for (const name of ['dispose', 'asyncDispose']) {
  if (typeof Symbol[name] !== 'symbol') {
    Object.defineProperty(Symbol, name, { value: Symbol(`Symbol.${name}`), writable: false, enumerable: false, configurable: false });
  }
}
