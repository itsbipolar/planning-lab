// A number you can drag, inside a sentence. Recreates the reactive-document idea (Bret Victor's Tangle) in new code;
// none of Tangle is copied. Keyboard: arrows step, Page Up/Down step ten, Home/End jump to the ends.
// It is a role="slider", so screen readers announce it; pages also show plain range inputs as a single-pointer alternative.
export function dragNumber(el, { min, max, step = 1, value, pxPerStep = 12, format = String, label, onChange }) {
  let v = value;
  el.setAttribute('role', 'slider');
  el.tabIndex = 0;
  el.setAttribute('aria-label', label);
  el.setAttribute('aria-valuemin', min);
  el.setAttribute('aria-valuemax', max);
  el.classList.add('drag-number');
  const clamp = (x) => Math.min(max, Math.max(min, Math.round(x / step) * step));
  const set = (x, notify = true) => {
    const n = clamp(x);
    v = n;
    el.textContent = format(n);
    el.setAttribute('aria-valuenow', n);
    el.setAttribute('aria-valuetext', format(n));
    if (notify && onChange) onChange(n);
  };
  el.addEventListener('keydown', (e) => {
    const big = step * 10;
    const moves = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big };
    if (e.key in moves) set(v + moves[e.key]);
    else if (e.key === 'Home') set(min);
    else if (e.key === 'End') set(max);
    else return;
    e.preventDefault();
  });
  let startX = 0, startV = 0;
  el.addEventListener('pointerdown', (e) => {
    startX = e.clientX; startV = v; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    set(startV + Math.round((e.clientX - startX) / pxPerStep) * step);
  });
  const end = (e) => { if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); el.classList.remove('dragging'); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  set(v, false);
  return { set: (x) => set(x, false), get value() { return v; } };
}
