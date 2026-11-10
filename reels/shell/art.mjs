// Print-style pictures drawn in code: ink line work, engraving hatch and halftone dots, no colour but ink.
// No digits and no real logos, crests or documents: these are drawings of ordinary things, one per account.
// Every id is prefixed with `p` so many drawings can share a page; tweens target the ids named in `moves`.
const INK = '#15120E', MID = '#4B4740', PAPER = '#F4EEE3';

function defs(p) {
  return `<defs>
<pattern id="${p}-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${INK}" stroke-width="1.7"/></pattern>
<pattern id="${p}-hatch2" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="6" stroke="${INK}" stroke-width="1.3"/></pattern>
<pattern id="${p}-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.7" fill="${MID}"/></pattern>
</defs>`;
}
const S = `fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`;
const T = (x, y, s, txt, extra = '') => `<text x="${x}" y="${y}" font-family="Archivo Variable,sans-serif" font-weight="700" font-size="${s}" letter-spacing="1.5" fill="${INK}" ${extra}>${txt}</text>`;
const lines = (x, y, w, n, gap, sw = 3) => Array.from({ length: n }, (_, i) => `<line x1="${x}" y1="${y + i * gap}" x2="${x + w * (i % 3 === 2 ? 0.6 : 1)}" y2="${y + i * gap}" stroke="${MID}" stroke-width="${sw}" stroke-linecap="round"/>`).join('');

const DRAW = {
  // OAS: a pension cheque sliding out of its envelope.
  cheque: p => `
<ellipse cx="164" cy="300" rx="132" ry="12" fill="url(#${p}-dots)"/>
<g id="${p}-cheque" transform="rotate(-7 160 120)">
  <rect x="58" y="62" width="214" height="118" fill="${PAPER}" ${S}/>
  <rect x="58" y="62" width="214" height="22" fill="url(#${p}-hatch2)" stroke="${INK}" stroke-width="4"/>
  ${T(72, 112, 13, 'PAY TO THE ORDER OF')}${lines(72, 132, 180, 1, 0)}
  <path d="M176 160 c10 -16 18 10 28 -4 s14 -8 24 2 s10 -2 18 -6" ${S} stroke-width="3"/>
</g>
<path d="M34 150 L290 150 L290 290 L34 290 Z" fill="${PAPER}" ${S}/>
<path d="M34 290 L34 150 L162 226 L290 150 L290 290 Z" fill="url(#${p}-hatch)" stroke="none" opacity=".55"/>
<path d="M34 150 L162 226 L290 150" ${S}/><path d="M34 290 L130 210 M290 290 L194 210" ${S} stroke-width="3"/>`,
  // RRSP: a savings-plan form getting its registration stamp.
  form: p => `
<rect x="72" y="40" width="200" height="262" fill="url(#${p}-dots)"/>
<rect x="58" y="26" width="200" height="262" fill="${PAPER}" ${S}/>
<rect x="58" y="26" width="200" height="40" fill="url(#${p}-hatch)" stroke="${INK}" stroke-width="4"/>
${T(74, 92, 14, 'RETIREMENT')}${T(74, 110, 14, 'SAVINGS PLAN')}
${[132, 162, 192].map(y => `<rect x="74" y="${y}" width="16" height="16" ${S} stroke-width="3"/>`).join('')}${lines(100, 141, 136, 3, 30)}
${lines(74, 240, 166, 2, 22)}
<g id="${p}-stamp" transform="rotate(-14 196 236)">
  <rect x="128" y="206" width="138" height="60" rx="8" fill="${PAPER}" fill-opacity=".85" ${S} stroke-width="5"/>
  <rect x="136" y="214" width="122" height="44" rx="5" ${S} stroke-width="2.5"/>
  ${T(197, 242, 14, 'REGISTERED', 'text-anchor="middle"')}
</g>`,
  // CPP: a pay stub with the pension contribution line picked out.
  paystub: p => `
<rect x="88" y="34" width="176" height="270" fill="url(#${p}-dots)"/>
<path d="M72 22 h176 v270 h-176 Z" fill="${PAPER}" ${S}/>
<path d="M72 22 h176" stroke="${INK}" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>
${T(88, 58, 15, 'PAY STATEMENT')}<line x1="88" y1="70" x2="232" y2="70" stroke="${INK}" stroke-width="3"/>
${[96, 124, 152].map(y => `<line x1="88" y1="${y}" x2="168" y2="${y}" stroke="${MID}" stroke-width="3" stroke-linecap="round"/><line x1="196" y1="${y}" x2="232" y2="${y}" stroke="${MID}" stroke-width="3" stroke-linecap="round"/>`).join('')}
<rect id="${p}-hl" x="80" y="170" width="160" height="40" fill="url(#${p}-hatch2)" opacity=".5"/>
${T(88, 197, 15, 'PENSION PLAN')}
${[232, 258].map(y => `<line x1="88" y1="${y}" x2="168" y2="${y}" stroke="${MID}" stroke-width="3" stroke-linecap="round"/>`).join('')}
<line x1="88" y1="276" x2="232" y2="276" stroke="${INK}" stroke-width="3"/>`,
  // TFSA: an open savings passbook, its entries ticking in.
  passbook: p => `
<ellipse cx="160" cy="288" rx="138" ry="12" fill="url(#${p}-dots)"/>
<path d="M30 92 Q95 76 160 96 Q225 76 290 92 L290 262 Q225 248 160 268 Q95 248 30 262 Z" fill="${PAPER}" ${S}/>
<path d="M160 96 L160 268" ${S}/>
<path d="M30 262 Q95 248 160 268 Q225 248 290 262 L290 272 Q225 258 160 278 Q95 258 30 272 Z" fill="url(#${p}-hatch)" stroke="${INK}" stroke-width="3"/>
${T(50, 122, 13, 'SAVINGS')}
${[0, 1, 2, 3].map(i => `<g id="${p}-row${i}"><line x1="50" y1="${150 + i * 28}" x2="140" y2="${150 + i * 28}" stroke="${MID}" stroke-width="3" stroke-linecap="round"/><path d="M182 ${144 + i * 28} l8 8 l16 -14" ${S} stroke-width="3.5"/><line x1="216" y1="${150 + i * 28}" x2="270" y2="${150 + i * 28}" stroke="${MID}" stroke-width="3" stroke-linecap="round"/></g>`).join('')}`,
  // FHSA: a house key on a house-shaped tag.
  key: p => `
<ellipse cx="160" cy="300" rx="110" ry="10" fill="url(#${p}-dots)"/>
<circle cx="160" cy="26" r="9" fill="${INK}"/>
<g id="${p}-swing">
  <path d="M160 26 C150 60 172 80 160 104" ${S} stroke-width="3"/>
  <circle cx="160" cy="116" r="14" ${S}/>
  <path d="M100 180 L160 130 L220 180 L220 262 L100 262 Z" fill="${PAPER}" ${S}/>
  <path d="M100 262 L100 180 L160 130 L160 262 Z" fill="url(#${p}-hatch)" opacity=".5"/>
  <circle cx="160" cy="166" r="8" ${S} stroke-width="3"/>
  ${T(120, 226, 15, 'HOME')}
  <g transform="rotate(28 214 214)">
    <circle cx="232" cy="214" r="22" fill="${PAPER}" ${S}/><circle cx="232" cy="214" r="8" ${S} stroke-width="3"/>
    <path d="M254 214 H316 M290 214 v12 M302 214 v9 M316 214 v14" ${S}/>
  </g>
</g>`,
};
export const ART_KINDS = Object.keys(DRAW);

const VIEW = { key: '84 14 244 296' };
export function art(kind, p, cls = 'art') {
  if (!DRAW[kind]) throw new Error(`no drawing called "${kind}"`);
  return `<svg class="${cls}" id="${p}" viewBox="${VIEW[kind] ?? '0 0 330 320'}" aria-hidden="true" overflow="visible">${defs(p)}${DRAW[kind](p)}</svg>`;
}

// Small motions, starting when the page has landed (`at`, scene-local seconds).
export function moves(kind, p, at) {
  const a = n => (at + n).toFixed(2);
  switch (kind) {
    case 'cheque': return `tl.fromTo("#${p}-cheque",{y:70},{y:0,duration:.8,ease:"power3.out"},${a(0)});`;
    case 'form': return `tl.fromTo("#${p}-stamp",{scale:1.7,opacity:0,transformOrigin:"50% 50%"},{scale:1,opacity:1,duration:.22,ease:"power4.in"},${a(0.35)});`;
    case 'paystub': return `tl.fromTo("#${p}-hl",{scaleX:0,transformOrigin:"0% 50%"},{scaleX:1,duration:.6,ease:"power2.out"},${a(0.3)});`;
    case 'passbook': return [0, 1, 2, 3].map(i => `tl.fromTo("#${p}-row${i}",{opacity:0},{opacity:1,duration:.15},${a(0.2 + i * 0.28)});`).join('');
    case 'key': return `tl.set("#${p}-swing",{svgOrigin:"160 26",rotation:16},0);tl.to("#${p}-swing",{keyframes:[{rotation:-10,duration:.55},{rotation:6,duration:.5},{rotation:-3,duration:.45},{rotation:0,duration:.4}],ease:"sine.inOut"},${a(0)});`;
    default: return '';
  }
}
