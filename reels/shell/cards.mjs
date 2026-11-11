// The six card types as HTML, in two formats from the same markup: the 9:16 reel (1080x1920) and the
// 4:5 carousel (1080x1350). Two print looks: "paper" (full-bleed paper) and "sheet" (a paper sheet on the
// house dark ground). Years are set in Source Serif 4, everything else in Archivo; amber is a mark only.
import { readJSON, ROOT } from './lib.mjs';
import { join } from 'node:path';
import { art, moves, ART_KINDS } from './art.mjs';
import { seriesSVG } from './chart.mjs';

const tokens = readJSON(join(ROOT, 'shared', 'tokens.json'));
export const FORMATS = {
  reel: { w: 1080, h: 1920, top: 176, bottom: 590, left: 84, right: 150 }, // text stays in 176..1330 and clear of the right-hand rail
  carousel: { w: 1080, h: 1350, top: 96, bottom: 96, left: 84, right: 84 },
};
export const LOOKS = {
  paper: { label: 'Paper', ground: '#F4EEE3', paper: '#F4EEE3', inset: 0 },
  sheet: { label: 'Sheet on dark', ground: tokens.dark.ground, paper: '#F4EEE3', inset: 52, stack: true },
};
const INK = tokens.dark.ground, INK2 = tokens.light.ink2, RULE = '#CFC5B4', POINT = tokens.dark.point;

export { ART_KINDS };
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function fontFaces(prefix = 'assets/fonts/') {
  return `@font-face{font-family:"Archivo Variable";src:url("${prefix}archivo-latin-wght-normal.woff2") format("woff2");font-weight:100 900}
@font-face{font-family:"Source Serif 4";src:url("${prefix}source-serif-4-latin-600-normal.woff2") format("woff2");font-weight:600}
@font-face{font-family:"Source Serif 4";src:url("${prefix}source-serif-4-latin-400-normal.woff2") format("woff2");font-weight:400}`;
}

// Styles for one card, scoped under its own id so many cards can share a page.
export function cardCSS(sel, lookName, fmtName) {
  const L = LOOKS[lookName], F = FORMATS[fmtName];
  const big = fmtName === 'reel';
  return `
${sel}{position:absolute;inset:0;perspective:2600px;overflow:hidden}
${sel} .page{position:absolute;inset:${L.inset}px;background:${L.paper};color:${INK};transform-origin:0% 50%;
  font-family:"Archivo Variable",system-ui,sans-serif;font-variant-numeric:lining-nums;
  box-shadow:${L.inset ? '0 18px 60px rgba(0,0,0,.45)' : 'none'};backface-visibility:hidden}
${sel} .spine{position:absolute;left:0;top:0;bottom:0;width:38px;background:linear-gradient(90deg,rgba(21,18,14,.10),rgba(21,18,14,0))}
${sel} .shade{position:absolute;inset:0;background:${INK};opacity:0;pointer-events:none}
${sel} .band{position:absolute;left:${F.left - L.inset}px;right:${F.right - L.inset}px;top:${F.top - L.inset}px;bottom:${F.bottom - L.inset}px;
  display:flex;flex-direction:column}
${sel} .head{display:flex;justify-content:space-between;align-items:baseline;font-size:${big ? 44 : 40}px;letter-spacing:.06em;
  text-transform:uppercase;color:${INK2};font-weight:500;padding-bottom:18px;border-bottom:3px solid ${INK};white-space:nowrap}
${sel} mark{background:${POINT};color:${INK};font-weight:700;padding:0 .16em;box-decoration-break:clone}
${sel} .short{font-size:${big ? 96 : 84}px;font-weight:700;margin-top:${big ? 44 : 30}px;line-height:1}
${sel} .name{font-size:${big ? 56 : 48}px;font-weight:500;color:${INK2};margin-top:18px;line-height:1.15}
${sel} .year{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:${big ? 300 : 250}px;line-height:.86;letter-spacing:-.02em;margin-top:${big ? 34 : 20}px}
${sel} .yr{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:${big ? 30 : 18}px}
${sel} .yr .year{margin-top:0}
${sel} .art{width:${big ? 286 : 270}px;height:${big ? 278 : 262}px;flex:none;overflow:visible}
${sel} .icons{display:flex;justify-content:space-between;margin-top:${big ? 70 : 44}px}
${sel} .icons .icon{width:${big ? 150 : 140}px;height:${big ? 146 : 136}px;overflow:visible}
${sel} .plate{position:absolute;left:${F.left - L.inset}px;right:${F.left - L.inset}px;top:${F.h - F.bottom - L.inset + 14}px;bottom:${big ? 46 : 0}px;
  border-top:3px solid ${INK};display:flex;justify-content:center;align-items:center;gap:10px}
${sel} .plate .art{width:auto;height:100%}
${sel} .plate .icon{width:19%;height:auto}
${sel} .stitle{font-size:${big ? 64 : 56}px;font-weight:700;line-height:1.08;margin-top:${big ? 40 : 26}px}
${sel} .sdelta{font-size:${big ? 104 : 88}px;font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:${big ? 22 : 14}px}
${sel} .sdelta .from{color:${INK2};font-weight:600}
${sel} .sdelta .arrow{font-size:.45em;font-weight:500;color:${INK2};margin:0 .25em}
${sel} .sdelta .what{font-size:.38em;font-weight:600;color:${INK2};margin-left:.3em}
${sel} .chart{display:block;margin-top:${big ? 30 : 18}px;overflow:visible;width:100%;height:auto}
${sel} .chart .cg{stroke:${RULE};stroke-width:2}
${sel} .chart .ca{stroke:${INK};stroke-width:3}
${sel} .chart .ct{fill:${INK2};font-size:${big ? 40 : 36}px;font-variant-numeric:tabular-nums}
${sel} .chart .cf{fill:${INK};opacity:.06}
${sel} .chart .cb{stroke:${INK2};stroke-width:3;stroke-dasharray:14 10}
${sel} .chart .cl{fill:none;stroke:${INK};stroke-width:9;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1 1}
${sel} .chart .cl.dashed{stroke:${INK2};stroke-width:6;stroke-dasharray:.018 .012}
${sel} .chart .cl.thin{stroke-width:5}
${sel} .chart .cr{fill:${L.paper};stroke:${INK};stroke-width:6}
${sel} .chart .cd{stroke:${INK2};stroke-width:3}
${sel} .chart .cc{fill:${INK};font-weight:800;font-variant-numeric:tabular-nums}
${sel} .chart .cc.marked{paint-order:stroke;stroke:${POINT};stroke-width:30px;stroke-linejoin:round}
${sel} .snote{font-size:${big ? 44 : 40}px;line-height:1.22;color:${INK2};margin-top:${big ? 26 : 14}px}
${sel} .bigyear{font-size:${big ? 230 : 190}px;font-weight:800;line-height:.9;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin-top:${big ? 30 : 16}px}
${sel} .sparks{display:grid;grid-template-columns:1fr 1fr;gap:${big ? '34px 40px' : '22px 30px'};margin-top:auto;margin-bottom:${big ? 30 : 0}px}
${sel} .sparks b{display:block;font-size:${big ? 36 : 32}px;font-weight:700;line-height:1.1;margin-bottom:8px}
${sel} .sparks .chart{margin-top:0}
${sel} .kicker{font-size:${big ? 58 : 60}px;font-weight:700;line-height:1.1;margin-top:${big ? 110 : 150}px}
${sel} .when-big{font-size:${big ? 120 : 130}px;font-weight:800;line-height:1;letter-spacing:-.02em;margin-top:${big ? 30 : 20}px;font-variant-numeric:tabular-nums}
${sel} .sub{font-size:${big ? 54 : 54}px;line-height:1.22;color:${INK2};margin-top:${big ? 40 : 24}px}
${sel} .props{display:flex;flex-direction:column;gap:${big ? 22 : 30}px;margin-top:${big ? 24 : 30}px}
${sel} .prop{border-top:3px solid ${INK};padding-top:${big ? 18 : 12}px}
${sel} .prop .pw{font-size:${big ? 40 : 40}px;color:${INK2};font-variant-numeric:tabular-nums}
${sel} .prop .pt{font-size:${big ? 50 : 52}px;font-weight:700;line-height:1.12;margin-top:6px}
${sel} .prop .pv{font-size:${big ? 46 : 48}px;font-weight:800;line-height:1.15;margin-top:6px;font-variant-numeric:tabular-nums}
${sel} .props.dense{gap:${big ? 14 : 24}px}
${sel} .props.dense .prop{padding-top:${big ? 12 : 8}px}
${sel} .props.dense .pw{font-size:${big ? 38 : 38}px}
${sel} .props.dense .pt{font-size:${big ? 46 : 48}px}
${sel} .props.dense .pv{font-size:${big ? 42 : 44}px}
${sel} .props.dense .stamp{margin-top:8px;font-size:${big ? 32 : 28}px}
${sel} .stamp{display:inline-block;margin-top:${big ? 14 : 10}px;padding:4px 16px;border:4px dashed ${INK2};font-size:${big ? 36 : 32}px;font-weight:700;color:${INK2};transform:rotate(-2deg)}
${sel} .grain{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:multiply}
${sel} .qual{font-size:${big ? 46 : 42}px;color:${INK2};margin-top:14px}
${sel} .beat{font-size:${big ? 68 : 56}px;font-weight:650;line-height:1.16;margin-top:${big ? 40 : 28}px}
${sel} .today{font-size:${big ? 60 : 50}px;line-height:1.22;color:${INK2};margin-top:20px}
${sel} .src{font-size:${big ? 44 : 40}px;color:${INK2};margin-top:auto;padding-top:20px}
${sel} .ruler{position:relative;height:56px;margin-top:22px}
${sel} .ruler .line{position:absolute;left:0;right:0;top:26px;height:4px;background:${INK};transform-origin:0 50%}
${sel} .ruler .dot{position:absolute;top:16px;width:24px;height:24px;margin-left:-12px;border-radius:50%;background:${L.paper};border:4px solid ${INK};box-sizing:border-box}
${sel} .ruler .dot.on{background:${INK}}
${sel} .ruler .marker{position:absolute;top:0;width:6px;height:56px;margin-left:-3px;background:${INK}}
${sel} .hook{font-size:${big ? 96 : 84}px;font-weight:700;line-height:1.06;letter-spacing:-.01em;margin-top:${big ? 120 : 70}px}
${sel} .range{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:${big ? 170 : 150}px;line-height:1;margin-top:auto;margin-bottom:${big ? 34 : 0}px;letter-spacing:-.02em}
${sel} .range .to{color:${INK2};font-weight:400}
${sel} .lede{font-size:${big ? 72 : 62}px;font-weight:650;line-height:1.12;margin-top:${big ? 64 : 40}px}
${sel} .axis{position:relative;margin:${big ? 70 : 44}px 0 0 6px}
${sel} .axis .line{position:absolute;left:18px;top:0;width:5px;background:${INK};transform-origin:50% 0}
${sel} .axis .lead{position:absolute;left:0;top:0}
${sel} .axis .pt{position:absolute;left:20px;width:0;height:0}
${sel} .axis .pt i{position:absolute;left:-15px;top:-15px;width:30px;height:30px;border-radius:50%;background:${INK}}
${sel} .axis .lab{position:absolute;left:118px;transform:translateY(-50%);white-space:nowrap;line-height:1;display:flex;align-items:baseline;gap:22px}
${sel} .axis .lab b{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:${big ? 84 : 72}px}
${sel} .axis .lab span{font-size:${big ? 54 : 48}px;font-weight:700;color:${INK2}}
${sel} .stat{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:${big ? 420 : 340}px;line-height:.9;margin-top:auto;letter-spacing:-.03em}
${sel} .stattext{font-size:${big ? 72 : 62}px;font-weight:650;line-height:1.12;margin:${big ? 24 : 16}px 0 auto}
${sel} .rows{margin-top:${big ? 34 : 22}px;display:flex;flex-direction:column;gap:${big ? 18 : 10}px}
${sel} .rows div{border-top:2px solid ${RULE};padding-top:${big ? 12 : 8}px}
${sel} .rows b{font-size:${big ? 54 : 48}px;font-weight:700}
${sel} .rows b em{font-style:normal;font-family:"Source Serif 4",Georgia,serif;font-weight:600;margin-left:.3em}
${sel} .rows span{display:block;font-size:${big ? 44 : 40}px;color:${INK2};margin-top:4px}
${sel} .edu{font-size:${big ? 84 : 72}px;font-weight:700;line-height:1.08;margin-top:${big ? 120 : 70}px}
${sel} .ai{font-size:${big ? 52 : 42}px;line-height:1.25;color:${INK2};margin-top:${big ? 48 : 32}px}
${sel} .foot{font-size:40px;color:${INK2};margin-top:auto;padding-top:10px;border-top:2px solid ${RULE}}
${sel} .folio{position:absolute;left:${F.left - L.inset}px;right:${F.right - L.inset}px;bottom:${big ? 120 : 40}px;font-size:40px;color:${INK2};
  display:flex;justify-content:space-between;letter-spacing:.06em}
`;
}

const pos = (year, range) => (year - range.from) / (range.to - range.from) * 100;

function ruler(c, model, p) {
  const dots = model.dates.map((d, i) => `<span class="dot${i <= c.index ? ' on' : ''}" style="left:${pos(d.year, model.range)}%"></span>`).join('');
  return `<div class="ruler r"><span class="line" id="${p}-rline"></span>${dots}<span class="marker" id="${p}-marker" style="left:${pos(c.year, model.range)}%"></span></div>`;
}

// A vertical timeline: dots at true proportional positions, labels pushed apart so they never overlap,
// each joined to its dot by a leader line.
const AXIS = { reel: { h: 620, gap: 96 }, carousel: { h: 600, gap: 84 } };
export function axisLayout(model, fmt) {
  const { h, gap } = AXIS[fmt];
  const dots = model.dates.map(d => pos(d.year, model.range) / 100 * h);
  const labs = [];
  dots.forEach((y, i) => labs.push(i ? Math.max(y, labs[i - 1] + gap) : y));
  for (let i = labs.length - 1; i >= 0; i--) labs[i] = Math.min(labs[i], i === labs.length - 1 ? h : labs[i + 1] - gap);
  return { h, dots, labs };
}
function axis(model, p, fmt) {
  const { h, dots, labs } = axisLayout(model, fmt);
  const lead = dots.map((y, i) => `<path id="${p}-ld${i}" d="M20 ${y} H48 L84 ${labs[i]} H104" fill="none" stroke="${INK}" stroke-width="3"/>`).join('');
  const pts = model.dates.map((d, i) => `<div class="pt" id="${p}-pt${i}" style="top:${dots[i]}px"><i></i></div>
<div class="lab" id="${p}-lb${i}" style="top:${labs[i]}px"><b>${d.year}</b><span>${esc(d.short)}</span></div>`).join('');
  return `<div class="axis r" style="height:${h}px"><span class="line" id="${p}-aline" style="height:${h}px"></span><svg class="lead" width="120" height="${h}" overflow="visible">${lead}</svg>${pts}</div>`;
}

// The inner markup of one card. `fmt` is "reel" or "carousel"; `p` prefixes every id.
export function cardHTML(c, model, fmt, p, { showFoot = false } = {}) {
  const head = `<div class="head r"><span>${esc(model.reel.series)}</span><span>${c.type === 'date' ? `${c.index + 1} / ${model.dates.length}` : ''}</span></div>`;
  const foot = showFoot ? `<div class="foot">${esc(model.endText)}</div>` : '';
  let body = '';
  switch (c.type) {
    case 'hook':
      if (model.data) {
        const dm = model.data, sw = (FORMATS[fmt].w - FORMATS[fmt].left - FORMATS[fmt].right - 40) / 2;
        body = `<div class="hook r">${esc(c.text)}</div><div class="bigyear r">${dm.year}</div><div class="sparks r">${dm.panels.map((pn, i) =>
          `<div><b>${esc(pn.title)}</b>${seriesSVG(pn, dm, `${p}-s${i}`, { w: Math.round(sw), h: fmt === 'reel' ? 150 : 210, big: false })}</div>`).join('')}</div>`; break;
      }
      const icons = model.cards.filter(x => x.type === 'date' && x.art).map((x, i) => art(x.art, `${p}-i${i}`, 'icon')).join('');
      body = `<div class="hook r">${esc(c.text)}</div>${fmt === 'reel' ? '' : `<div class="icons r">${icons}</div>`}<div class="range r">${c.from}<span class="to">–${c.to}</span></div>`; break;
    case 'date':
      body = `<div class="short r"><mark>${esc(c.short)}</mark></div><div class="name r">${esc(c.name)}</div>
<div class="yr r"><div class="year" id="${p}-year">${c.year}</div>${c.art && fmt !== 'reel' ? art(c.art, `${p}-art`) : ''}</div>${c.qualifier ? `<div class="qual r">In law: ${esc(c.qualifier)}</div>` : ''}
<div class="beat r">${esc(c.beat)}</div><div class="today r">${esc(c.today)}</div>
<div class="src r">Source: ${esc(c.source)}</div>${ruler(c, model, p)}`; break;
    case 'chart':
      body = `<div class="lede r">${esc(c.text)}</div>${axis(model, p, fmt)}`; break;
    case 'stat':
      body = `<div class="stat r">${c.value}</div><div class="stattext r">${esc(c.text)}</div>`; break;
    case 'sources':
      body = `<div class="lede r">${esc(c.text)}</div><div class="rows">${c.lines.map(l =>
        `<div class="r"><b>${esc(l.short)}${l.year ? `<em>${l.year}</em>` : ''}</b><span>${esc(l.source)}</span></div>`).join('')}</div>`; break;
    case 'series': {
      const pn = c.panel, w = FORMATS[fmt].w - FORMATS[fmt].left - FORMATS[fmt].right;
      body = `<div class="stitle r">${esc(pn.title)}</div><div class="sdelta r"><span class="from">${esc(pn.summary.from)}</span><span class="arrow">to</span>${esc(pn.summary.to)}${pn.summary.label ? `<span class="what">${esc(pn.summary.label)}</span>` : ''}</div>
${seriesSVG(pn, model.data, p, { w, h: fmt === 'reel' ? 470 : 620 })}<div class="snote r">${esc(pn.note)}</div>`; break;
    }
    case 'section':
      body = `<div class="kicker r">${esc(c.text)}</div><div class="when-big r">${esc(c.when)}</div>${c.sub ? `<div class="sub r">${esc(c.sub)}</div>` : ''}`; break;
    case 'proposals':
      body = `<div class="bigyear r" style="font-size:${c.items.length > 2 ? (fmt === 'reel' ? 150 : 120) : (fmt === 'reel' ? 200 : 160)}px">${c.year}</div><div class="props${c.items.length > 2 ? ' dense' : ''}">${c.items.map((it, i) =>
        `<div class="prop r"><div class="pw">${esc(it.when)}</div><div class="pt">${esc(it.title)}</div><div class="pv">${esc(it.value)}</div><div class="stamp" id="${p}-st${i}">Proposed, not law</div></div>`).join('')}</div>`; break;
    case 'end':
      body = `<div class="edu r">${esc(c.text)}</div><div class="ai r">${esc(c.ai)}</div>${c.voice_note ? `<div class="ai r">${esc(c.voice_note)}</div>` : ''}`; break;
  }
  const grain = `<svg class="grain" aria-hidden="true"><filter id="${p}-grain"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .26  0 0 0 0 .2  0 0 0 .08 0"/></filter><rect width="100%" height="100%" filter="url(#${p}-grain)"/></svg>`;
  let plate = '';
  if (fmt === 'reel' && c.type === 'date' && c.art) plate = `<div class="plate">${art(c.art, `${p}-art`)}</div>`;
  const drawn = model.cards.filter(x => x.type === 'date' && x.art);
  if (fmt === 'reel' && (c.type === 'hook' || c.type === 'end') && drawn.length) plate = `<div class="plate">${drawn.map((x, i) => art(x.art, `${p}-i${i}`, 'icon')).join('')}</div>`;
  return `<div class="page" id="${p}-page">${grain}<span class="spine"></span><div class="band">${head}${body}${foot}</div>${plate}<span class="shade" id="${p}-shade"></span></div>`;
}

// GSAP tweens for one card, at scene-local seconds. `turn` is the page-turn length; 0 for the first card.
export function cardTweens(c, model, p, turn, sel, fmt = 'reel') {
  const t = [];
  if (turn > 0) {
    t.push(`tl.fromTo("#${p}-page",{rotationY:-104},{rotationY:0,duration:${turn},ease:"power2.out"},0);`);
    t.push(`tl.fromTo("#${p}-shade",{opacity:.35},{opacity:0,duration:${turn},ease:"power1.out"},0);`);
  }
  if (c.type === 'date' && c.index > 0) {
    const F = FORMATS[fmt], width = F.w - F.left - F.right;
    const dx = (pos(model.dates[c.index - 1].year, model.range) - pos(c.year, model.range)) / 100 * width;
    t.push(`tl.fromTo("#${p}-marker",{x:${dx.toFixed(1)}},{x:0,duration:.7,ease:"power2.inOut"},${(turn + 0.5).toFixed(2)});`);
  }
  if (c.type === 'date' && c.art) t.push(moves(c.art, `${p}-art`, turn + 0.15));
  // The first card is the thumbnail and the hook: its drawings are already moving on frame 0.
  if (c.type === 'hook') model.cards.filter(x => x.type === 'date' && x.art).forEach((x, i) =>
    t.push(`tl.fromTo("#${p}-i${i}",{y:-22,rotation:-5},{y:0,rotation:0,duration:.55,ease:"back.out(2.2)"},${(i * 0.14).toFixed(2)});`));
  if (c.type === 'series') {
    c.panel.lines.forEach((ln, li) => !ln.dashed && t.push(`tl.fromTo("#${p}-l${li}",{strokeDashoffset:1},{strokeDashoffset:0,duration:1.8,ease:"power1.inOut"},${(turn + 0.15).toFixed(2)});`));
    c.panel.callouts.forEach((_, ci) => t.push(`tl.fromTo("#${p}-c${ci}",{opacity:0,y:16},{opacity:1,y:0,duration:.35,ease:"back.out(2)"},${(turn + 1.9 + ci * 0.3).toFixed(2)});`));
  }
  if (c.type === 'proposals') c.items.forEach((_, i) =>
    t.push(`tl.fromTo("#${p}-st${i}",{scale:1.6,opacity:0},{scale:1,opacity:1,duration:.22,ease:"power4.in"},${(turn + 0.5 + i * 0.35).toFixed(2)});`));
  // A data reel's hook is moving on frame 0: its four lines are already drawing.
  if (c.type === 'hook' && model.data) model.data.panels.forEach((pn, i) => pn.lines.forEach((ln, li) =>
    !ln.dashed && t.push(`tl.fromTo("#${p}-s${i}-l${li}",{strokeDashoffset:.55},{strokeDashoffset:0,duration:1.4,ease:"power1.out"},${(i * 0.12).toFixed(2)});`)));
  if (c.type === 'chart') {
    const t0 = turn + 0.2, run = 1.6;
    t.push(`tl.fromTo("#${p}-aline",{scaleY:0},{scaleY:1,duration:${run},ease:"none"},${t0.toFixed(2)});`);
    model.dates.forEach((d, i) => {
      const at = t0 + run * pos(d.year, model.range) / 100;
      t.push(`tl.fromTo(["#${p}-pt${i}","#${p}-ld${i}","#${p}-lb${i}"],{opacity:0},{opacity:1,duration:.25},${at.toFixed(2)});`);
    });
  }
  return t.join('\n');
}
