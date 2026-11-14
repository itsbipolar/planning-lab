// The Ages That Matter (P5c): three retirement rules laid out square by square, computed from the confirmed facts only.
// CPP: the change for each start month against the standard age; OAS: the increase for each month of deferral; RRIF: the
// minimum factor for each age. No rate, age or factor is written here. The example fund is an illustration, labelled so.

export const EXAMPLE_FUND = 100000; // an example balance for the RRIF readout: not a recommendation or anyone's amount

export function buildModel(factsFile) {
  const F = new Map(factsFile.facts.filter((f) => f.status === 'confirmed').map((f) => [f.id, f]));
  const need = (id) => { const f = F.get(id); if (!f) throw new Error(`fact ${id} is not confirmed`); return f; };
  const num = (id) => Number(need(id).value);
  const src = (...ids) => ids.map((id) => ({ id, title: need(id).title, source_url: need(id).source_url, as_of: need(id).as_of }));

  // CPP: months from the standard start; before it, less by the reduction a month; after it, more by the increase a month.
  const lo = num('cpp_earliest_start_age'), std = num('cpp_standard_start_age'), hi = num('cpp_latest_start_age');
  const red = num('cpp_early_start_reduction'), inc = num('cpp_late_start_increase');
  const cppCells = [];
  for (let a = lo; a <= hi; a++) for (let m = 0; m < 12; m++) {
    if (a === hi && m > 0) break; // no start after the latest age
    const k = (a - std) * 12 + m;
    cppCells.push({ age: a, month: m, k, pct: round(k < 0 ? k * red : k * inc) });
  }
  // OAS: months of deferral after the start age, up to the age the increase stops.
  const o0 = num('oas_start_age'), oMax = num('oas_deferral_max_age'), oInc = num('oas_deferral_increase');
  const oasCells = [];
  for (let a = o0; a <= oMax; a++) for (let m = 0; m < 12; m++) {
    if (a === oMax && m > 0) break;
    const k = (a - o0) * 12 + m;
    oasCells.push({ age: a, month: m, k, pct: round(k * oInc) });
  }
  // RRIF: the factor for the age at the start of the year; the last row covers that age or older.
  const rrifRows = need('rrif_minimum_factors').value.map((r) => ({ age: r.age, factor: Number(r.factor) }));
  const range = (cells) => [Math.min(...cells.map((c) => c.pct)), Math.max(...cells.map((c) => c.pct))];
  return {
    cpp: { lo, std, hi, red, inc, cells: cppCells, range: range(cppCells), sources: src('cpp_earliest_start_age', 'cpp_standard_start_age', 'cpp_latest_start_age', 'cpp_early_start_reduction', 'cpp_late_start_increase') },
    oas: { start: o0, max: oMax, inc: oInc, cells: oasCells, range: range(oasCells), sources: src('oas_start_age', 'oas_deferral_max_age', 'oas_deferral_increase') },
    rrif: { rows: rrifRows, range: [Math.min(...rrifRows.map((r) => r.factor)), Math.max(...rrifRows.map((r) => r.factor))], maturity: num('rrsp_maturity_age'), fund: EXAMPLE_FUND, sources: src('rrif_minimum_factors', 'rrsp_maturity_age') },
  };
}
const round = (x) => Math.round(x * 1000) / 1000;
