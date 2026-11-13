"""Letter cases computed independently of calc.mjs, step by step from the rules in facts.json, with exact fractions.
Each case is one spouse: start ages, illustrative amounts and other income. Run: python3 tests/golden.py
(writes fixtures/golden.json, which tests/calc.test.mjs checks calc.mjs against)."""
import json
import re
from fractions import Fraction as F
from pathlib import Path

here = Path(__file__).resolve().parent.parent
facts = {f["id"]: f for f in json.loads((here / ".." / ".." / "shared" / "facts.json").read_text())["facts"]
         if f["status"] == "confirmed"}
v = lambda i: F(facts[i]["value"])
std, lo, hi = int(v("cpp_standard_start_age")), int(v("cpp_earliest_start_age")), int(v("cpp_latest_start_age"))
down, up = v("cpp_early_start_reduction") / 100, v("cpp_late_start_increase") / 100
oas0, oas_hi, oas_up = int(v("oas_start_age")), int(v("oas_deferral_max_age")), v("oas_deferral_increase") / 100
boost = v("oas_age75_increase") / 100
boost_age = int(re.search(r"\bage (\d+)\b", facts["oas_age75_increase"]["title"]).group(1))
rate = v("oas_recovery_rate") / 100
thr = max((f for f in facts.values() if f["series"] == "oas_recovery_threshold"), key=lambda f: f["tax_year"])
threshold = F(thr["value"])


def oas_years(share, start, x):
    """OAS received by age x, in years of the pension at the start age."""
    return share * (max(0, x - start) + boost * max(0, x - max(start, boost_age)))


def oas_cross(age):
    if age == oas0:
        return None
    s = 1 + (age - oas0) * 12 * oas_up
    # Search each straight piece of the two totals (they bend only at the boost age) for the age where they meet.
    for a, b in ((max(age, oas0), boost_age), (boost_age, 200)):
        fa = lambda x: oas_years(s, age, x) - oas_years(1, oas0, x)
        ya, yb = fa(F(a)), fa(F(b))
        if ya <= 0 <= yb and yb != ya:
            return F(a) + (F(b) - a) * (-ya) / (yb - ya)
    return None


cases = [
    dict(cppAge=hi, oasAge=oas_hi, cppAt65=1100, oasAt65=720, other=72000),     # the example's Lena
    dict(cppAge=std - 2, oasAge=oas0, cppAt65=850, oasAt65=720, other=38000),   # the example's Tom
    dict(cppAge=lo, oasAge=oas0, cppAt65=1000, oasAt65=700, other=40000),
    dict(cppAge=std, oasAge=oas0 + 2, cppAt65=1200, oasAt65=700, other=95000),
    dict(cppAge=std + 3, oasAge=oas_hi, cppAt65=1500, oasAt65=720, other=200000),  # recovery reaches the whole OAS
]
out = []
for c in cases:
    months = (c["cppAge"] - std) * 12
    cpp_share = 1 + months * down if months < 0 else 1 + months * up
    cpp = c["cppAt65"] * cpp_share
    oas = c["oasAt65"] * (1 + (c["oasAge"] - oas0) * 12 * oas_up)
    # CPP totals equal: cpp * (x - age) == base * (x - std)  =>  x = (base*std - cpp*age) / (base - cpp)
    cpp_cross = None if c["cppAge"] == std else (c["cppAt65"] * std - cpp * c["cppAge"]) / (c["cppAt65"] - cpp)
    oc = oas_cross(c["oasAge"])
    net = c["other"] + 12 * (cpp + oas)
    rec = min(12 * oas, max(F(0), net - threshold) * rate)
    out.append({"input": c, "cppMonthly": float(cpp), "oasMonthly": float(oas),
                "cppCrossing": None if cpp_cross is None else float(cpp_cross),
                "oasCrossing": None if oc is None else float(oc),
                "net": float(net), "recovery": float(rec), "capped": rec > 0 and rec == 12 * oas})
(here / "fixtures" / "golden.json").write_text(json.dumps({"threshold": thr["id"], "cases": out}, indent=2) + "\n")
for o in out:
    print(o["input"], round(o["cppMonthly"], 2), round(o["oasMonthly"], 2), o["cppCrossing"] and round(o["cppCrossing"], 3),
          o["oasCrossing"] and round(o["oasCrossing"], 3), round(o["net"], 2), round(o["recovery"], 2), o["capped"])
