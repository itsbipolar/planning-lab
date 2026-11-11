// The Money Year model: every number on the page is computed here from the dated Bank of Canada snapshot
// (shared/data/money-year-<year>.json) or read from the confirmed facts (shared/facts.json). Nothing is typed in.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = (d) => { const [y, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${day}, ${y}`; };
export const shortDate = (d) => { const [, m, day] = d.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)} ${day}`; };
export const monthName = (d) => MONTHS[Number(d.slice(5, 7)) - 1];
const money = (v) => `$${Number(v).toLocaleString('en-CA')}`;

const extreme = (pts, pick) => pts.reduce((a, p) => (pick(p[1], a[1]) ? p : a));

// The policy rate's decisions: every day the target changed, with the rate before and after.
export function changes(points) {
  const out = [];
  for (let i = 1; i < points.length; i++) if (points[i][1] !== points[i - 1][1]) out.push({ d: points[i][0], from: points[i - 1][1], to: points[i][1] });
  return out;
}

export function buildModel(snap, factsFile) {
  const Y = snap.year, start = `${Y}-01-01`, end = `${Y}-12-31`;
  const inYear = (pts) => pts.filter(([d]) => d >= start && d <= end);
  const before = (pts) => pts.filter(([d]) => d < start).at(-1);
  const S = snap.series;

  // 1. Policy rate: the year's path, carried in from the last value of the year before.
  const pol = S.V39079.points, polYear = inYear(pol), polStart = before(pol) ?? polYear[0];
  const decisions = changes([polStart, ...polYear]);
  const firstChange = decisions[0];
  const policy = {
    id: 'policy', title: 'Bank of Canada policy rate', unit: '%', step: true, digits: 2,
    lines: [{ id: 'V39079', label: 'Target for the overnight rate', points: [[start, polStart[1]], ...polYear.filter(([d]) => d > start)] }],
    callouts: decisions.map((c) => ({ d: c.d, v: c.to, mark: true, text: `${shortDate(c.d)}: ${c.to > c.from ? 'raised' : 'cut'} to ${c.to.toFixed(2)}%` })),
    note: firstChange
      ? `Held at ${polStart[1].toFixed(2)}% from January 1 until ${longDate(firstChange.d)}. ${decisions.length === 1 ? 'One change' : `${decisions.length} changes`} so far this year.`
      : `Held at ${polStart[1].toFixed(2)}% all year so far.`,
    decisions, hero: true,
    summary: { from: `${polStart[1].toFixed(2)}%`, to: `${polYear.at(-1)[1].toFixed(2)}%` },
  };

  // 2. Posted 5-year mortgage rate (weekly): start, end, high and low.
  const mor = inYear(S.V80691335.points), mHi = extreme(mor, (a, b) => a > b), mLo = extreme(mor, (a, b) => a < b);
  const mortgage = {
    id: 'mortgage', title: 'Posted 5-year mortgage rate', unit: '%', digits: 2,
    lines: [{ id: 'V80691335', label: 'Conventional mortgage, 5-year', points: mor }],
    callouts: [{ d: mHi[0], v: mHi[1], text: `High ${mHi[1].toFixed(2)}%` }, { d: mLo[0], v: mLo[1], text: `Low ${mLo[1].toFixed(2)}%`, below: true }],
    summary: { from: `${mor[0][1].toFixed(2)}%`, to: `${mor.at(-1)[1].toFixed(2)}%` },
    note: `${mor[0][1].toFixed(2)}% in the first week of January, ${mor.at(-1)[1].toFixed(2)}% on ${longDate(mor.at(-1)[0])}. The posted rate is the banks' advertised rate; many borrowers pay less.`,
  };

  // 3. Core inflation (monthly, year over year): the Bank's CPI-trim and CPI-median.
  const trim = [before(S.CPI_TRIM.points), ...inYear(S.CPI_TRIM.points)].filter(Boolean);
  const med = [before(S.CPI_MEDIAN.points), ...inYear(S.CPI_MEDIAN.points)].filter(Boolean);
  const inflation = {
    id: 'inflation', title: 'Core inflation', unit: '%', digits: 1, monthly: true,
    lines: [{ id: 'CPI_TRIM', label: 'CPI-trim', points: trim }, { id: 'CPI_MEDIAN', label: 'CPI-median', points: med, dashed: true }],
    callouts: [], // the end labels already give the latest month's values
    summary: { from: `${trim[0][1].toFixed(1)}%`, to: `${trim.at(-1)[1].toFixed(1)}%`, label: 'CPI-trim' },
    note: `Year-over-year change in the Bank of Canada's two preferred core measures, which set aside the most volatile prices. CPI-trim went from ${trim[0][1].toFixed(1)}% (${monthName(trim[0][0])} ${trim[0][0].slice(0, 4)}) to ${trim.at(-1)[1].toFixed(1)}% (${monthName(trim.at(-1)[0])}).`,
  };

  // 4. The loonie: Canadian dollars for one US dollar (daily).
  const fx = inYear(S.FXUSDCAD.points), fHi = extreme(fx, (a, b) => a > b), fLo = extreme(fx, (a, b) => a < b);
  const loonie = {
    id: 'loonie', title: 'Canadian dollars for one US dollar', unit: '', digits: 4,
    lines: [{ id: 'FXUSDCAD', label: 'USD/CAD', points: fx }],
    callouts: [{ d: fHi[0], v: fHi[1], text: `Weakest loonie: ${fHi[1].toFixed(4)}` }, { d: fLo[0], v: fLo[1], text: `Strongest: ${fLo[1].toFixed(4)}`, below: true }],
    summary: { from: fx[0][1].toFixed(4), to: fx.at(-1)[1].toFixed(4) },
    note: `Higher means one US dollar costs more Canadian dollars, so a weaker loonie. ${fx[0][1].toFixed(4)} on ${longDate(fx[0][0])}, ${fx.at(-1)[1].toFixed(4)} on ${longDate(fx.at(-1)[0])}.`,
  };

  // Budget 2026 proposals, from the confirmed facts only. A fact that isn't confirmed leaves its item out.
  const F = new Map(factsFile.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
  const has = (...ids) => ids.every((i) => F.has(i));
  const v = (i) => F.get(i).value;
  const budgetDay = F.has('budget2026_budget_day') ? v('budget2026_budget_day') : null;
  const proposals = [];
  if (has('budget2026_cgi_limit', 'budget2026_cgi_issue_window')) proposals.push({ id: 'cgi', at: budgetDay, dated: Boolean(budgetDay), // no confirmed date: it sits at the start of the lane, labelled 'From Budget Day'
    when: budgetDay ? `From ${longDate(budgetDay)}` : 'From Budget Day',
    title: 'Canada Growth Incentive exemption', value: `Up to ${money(v('budget2026_cgi_limit'))} per person, per business`,
    detail: `For qualifying shares ${v('budget2026_cgi_issue_window')}. Narrow: many conditions, and many kinds of business are excluded.`, facts: ['budget2026_cgi_limit', 'budget2026_cgi_issue_window'] });
  // "Taxation years that end after <year>": the first such tax year is the next one, so it sits in that year's column.
  const t1135After = has('budget2026_t1135_start') ? Number((String(v('budget2026_t1135_start')).match(/\b\d{4}\b/) ?? [])[0]) : NaN;
  if (has('budget2026_t1135_threshold', 'budget2026_t1135_start') && t1135After) proposals.push({ id: 't1135', at: `${t1135After + 1}-01-01`, dated: false,
    when: `Tax years that end after ${t1135After}`, title: 'Foreign property form T1135', value: `Filed above ${money(v('budget2026_t1135_threshold'))}`,
    detail: `Applies to ${v('budget2026_t1135_start')}.`, facts: ['budget2026_t1135_threshold', 'budget2026_t1135_start'] });
  if (has('budget2026_rrsp_for_life_consultation_deadline')) proposals.push({ id: 'rrsp', at: budgetDay ?? v('budget2026_rrsp_for_life_consultation_deadline'), dated: Boolean(budgetDay), // open from Budget Day until its deadline, so it sits with this year's items
    when: `Comments due ${longDate(v('budget2026_rrsp_for_life_consultation_deadline'))}`, stamp: 'Consultation', title: 'RRSP for life', value: 'A consultation on one account instead of an RRSP and a RRIF',
    detail: 'A consultation, not yet a proposal with a start date.', facts: ['budget2026_rrsp_for_life_consultation_deadline'] });
  if (has('budget2026_t1_filing_date', 'budget2026_t1_filing_date_start')) proposals.push({ id: 'filing', at: `${v('budget2026_t1_filing_date_start')}-01-01`, dated: false,
    when: `From the ${v('budget2026_t1_filing_date_start')} tax year`, title: 'Tax-filing deadline', value: `${v('budget2026_t1_filing_date')} for all individuals`,
    detail: 'The filing and balance-due dates, including for the self-employed.', facts: ['budget2026_t1_filing_date', 'budget2026_t1_filing_date_start'] });
  if (has('budget2026_caregiver_refundable_start', 'budget2026_caregiver_max_relief_2027')) proposals.push({ id: 'caregiver', at: `${v('budget2026_caregiver_refundable_start')}-01-01`, dated: false,
    when: `From the ${v('budget2026_caregiver_refundable_start')} tax year`, title: 'Canada Caregiver Credit becomes refundable', value: `Up to ${money(v('budget2026_caregiver_max_relief_2027'))} of relief for an infirm adult relative`,
    detail: 'Refundable means it can be paid even with little or no tax to pay.', facts: ['budget2026_caregiver_refundable_start', 'budget2026_caregiver_max_relief_2027'] });
  if (has('budget2026_instalment_threshold', 'budget2026_instalment_start')) proposals.push({ id: 'instalments', at: v('budget2026_instalment_start'), dated: true,
    when: `Tax years starting on or after ${longDate(v('budget2026_instalment_start'))}`, title: 'Tax instalments, outside Quebec', value: `Required above ${money(v('budget2026_instalment_threshold'))} owing`,
    detail: 'The threshold for paying tax in instalments during the year.', facts: ['budget2026_instalment_threshold', 'budget2026_instalment_start'] });
  proposals.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));

  return {
    year: Y, start, end, retrieved: snap.retrieved, budgetDay, panels: [policy, mortgage, inflation, loonie], proposals,
    budgetUrl: proposals.length ? F.get(proposals[0].facts[0]).source_url : null,
    source: { attribution: snap.attribution, terms_url: snap.terms_url, source_url: snap.source_url, retrieved: snap.retrieved },
  };
}
