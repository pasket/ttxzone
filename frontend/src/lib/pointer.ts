/** True on a device whose primary pointer is precise (mouse/trackpad) --
 * where auto-focusing a field is a convenience. On touch screens it would
 * pop the on-screen keyboard over the page unasked, so callers skip it. */
export function hasFinePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches
}
