// The Order of Returns: the Web Worker. enumerate.mjs is inlined above this at build time; the page starts the worker
// from a blob: URL, so it makes no request. It keeps each finished run so the page can ask where an order ranks.
var runs = {};
onmessage = function (e) {
  var m = e.data;
  if (m.type === 'run') {
    var t0 = performance.now(), last = 0;
    var res = enumerateOrders(m.params, function (p) {
      var now = performance.now();
      if (now - last > 40) { last = now; postMessage({ type: 'progress', key: m.key, p: p }); }
    });
    var ms = performance.now() - t0;
    runs[m.key] = res;
    postMessage({ type: 'done', key: m.key, ms: ms, summary: summarize(res, m.params.cards) });
  } else if (m.type === 'rank') {
    postMessage({ type: 'rank', key: m.key, id: m.id, rank: rankOutcome(runs[m.key], m.dep, m.value) });
  }
};
