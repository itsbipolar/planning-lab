# An independent, step-by-step computation of the golden case (no shared code with engine.mjs).
# Run: python3 -I tests/golden.py  -> prints the year table and writes fixtures/golden.json "expected".
import json, os
here = os.path.dirname(os.path.abspath(__file__))
path = os.path.join(here, '..', 'fixtures', 'golden.json')
g = json.load(open(path))
i = g['input']
bal = i['start']; rows = []; dep = None
for t, r in enumerate(i['returns']):
    w = i['withdrawal'] * (1 + i['indexation']) ** t
    paid = min(w, bal)
    if paid < w - 1e-9 and dep is None: dep = t + 1
    bal = (bal - paid) * (1 + r)
    rows.append({'year': t + 1, 'withdrawal': round(w, 6), 'paid': round(paid, 6), 'return': r, 'end_balance': round(bal, 6)})
    print(f"year {t+1}: withdraw {w:,.2f}, then {r:+.0%} -> {bal:,.2f}")
g['expected'] = {'balances': [x['end_balance'] for x in rows], 'paid': [x['paid'] for x in rows], 'depletionYear': dep, 'years': rows}
json.dump(g, open(path, 'w'), indent=2); open(path, 'a').write('\n')
