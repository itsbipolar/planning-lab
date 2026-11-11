// A measure from a data model, drawn as a static SVG for a card: one line (or two, one dashed), the year's months,
// three gridlines, the shaded part of the year not in yet, an optional Budget day line and the model's callouts.
// Ids carry the prefix `p` so the card's tweens can draw the line in and land the callouts. Sizes are in card pixels.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const t = (d) => Date.parse(d + 'T00:00:00Z');
const escx = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function seriesSVG(panel, dm, p, { w, h, big = true }) {
  const fs = big ? 1 : 0.62; // type scale for the small sparkline version
  const L = big ? 118 : 0, R = big ? 24 : 0, T = big ? 34 : 6, B = big ? 64 : 6;
  const T0 = t(dm.start), T1 = t(dm.end);
  const x = (d) => L + ((t(d) - T0) / (T1 - T0)) * (w - L - R);
  const all = panel.lines.flatMap((l) => l.points.map((q) => q[1]));
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max((hi - lo) * 0.3, hi * 0.02); lo -= pad; hi += pad;
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (h - T - B);
  const out = [];
  if (big) {
    for (let i = 0; i <= 2; i++) {
      const v = lo + pad + ((hi - lo - 2 * pad) * i) / 2;
      out.push(`<line class="cg" x1="${L}" x2="${w - R}" y1="${y(v)}" y2="${y(v)}"/>`);
      out.push(`<text class="ct" x="${L - 14}" y="${y(v) + 14}" text-anchor="end">${v.toFixed(panel.digits === 1 ? 1 : 2)}</text>`);
    }
    [0, 3, 6, 9].forEach((i) => {
      const d = `${dm.year}-${String(i + 1).padStart(2, '0')}-01`;
      out.push(`<text class="ct" x="${x(d)}" y="${h - 14}">${MON[i]}</text>`);
    });
    out.push(`<line class="ca" x1="${L}" x2="${w - R}" y1="${h - B}" y2="${h - B}"/>`);
  }
  const last = dm.retrieved < dm.end ? dm.retrieved : dm.end;
  if (last < dm.end) out.push(`<rect class="cf" x="${x(last)}" y="${T}" width="${w - R - x(last)}" height="${h - T - B}"/>`);
  if (big && dm.budgetDay) out.push(`<line class="cb" x1="${x(dm.budgetDay)}" x2="${x(dm.budgetDay)}" y1="${T}" y2="${h - B}"/>`);
  panel.lines.forEach((l, li) => {
    let d = '';
    l.points.forEach((q, i) => { const X = Math.max(L, x(q[0])), Y = y(q[1]); d += i === 0 ? `M${X.toFixed(1)},${Y.toFixed(1)}` : panel.step ? `H${X.toFixed(1)}V${Y.toFixed(1)}` : `L${X.toFixed(1)},${Y.toFixed(1)}`; });
    if (panel.step) d += `H${x(last).toFixed(1)}`;
    out.push(`<path id="${p}-l${li}" class="cl${l.dashed ? ' dashed' : ''}${big ? '' : ' thin'}" d="${d}" pathLength="1"/>`);
  });
  if (big) panel.callouts.forEach((c, ci) => {
    const cx = x(c.d), cy = y(c.v), dy = c.below ? 66 : -40;
    const anchor = cx > w - R - 260 ? 'end' : cx < L + 260 ? 'start' : 'middle';
    out.push(`<g id="${p}-c${ci}"><circle class="cr" cx="${cx}" cy="${cy}" r="12"/>` +
      `<line class="cd" x1="${cx}" x2="${cx}" y1="${cy + (c.below ? 14 : -14)}" y2="${cy + dy + (c.below ? -40 : 10)}"/>` +
      `<text class="cc${c.mark ? ' marked' : ''}" x="${cx}" y="${cy + dy}" text-anchor="${anchor}" style="font-size:${Math.round(44 * fs)}px">${escx(c.text)}</text></g>`);
  });
  return `<svg class="chart${big ? '' : ' spark'}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${out.join('')}</svg>`;
}
