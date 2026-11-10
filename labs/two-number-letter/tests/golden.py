"""Five letter cases computed independently of calc.mjs, step by step from the rules in facts.json.
Written by Claude Code at Mo's request (the plan had Mo compute these by hand). Run: python3 tests/golden.py"""
import json
from fractions import Fraction as F
from pathlib import Path

here = Path(__file__).resolve().parent.parent
facts = {f["id"]: f for f in json.loads((here / ".." / ".." / "shared" / "facts.json").read_text())["facts"]
         if f["status"] == "confirmed"}
std = int(facts["cpp_standard_start_age"]["value"])
down = F(facts["cpp_early_start_reduction"]["value"]) / 100
up = F(facts["cpp_late_start_increase"]["value"]) / 100
oas0 = int(facts["oas_start_age"]["value"])
oas_up = F(facts["oas_deferral_increase"]["value"]) / 100
thr = max((f for f in facts.values() if f["series"] == "oas_recovery_threshold"), key=lambda f: f["tax_year"])

cases = [
    dict(cppAge=std - 5, oasAge=oas0, cppAt65=1000, oasAt65=700, other=40000),
    dict(cppAge=std + 5, oasAge=oas0 + 5, cppAt65=1000, oasAt65=700, other=40000),
    dict(cppAge=std, oasAge=oas0 + 2, cppAt65=1200, oasAt65=700, other=80000),
    dict(cppAge=std - 3, oasAge=oas0, cppAt65=800, oasAt65=650, other=0),
    dict(cppAge=std + 3, oasAge=oas0 + 5, cppAt65=1500, oasAt65=720, other=70000),
]
out = []
for c in cases:
    months = (c["cppAge"] - std) * 12
    cpp_factor = 1 + months * down if months < 0 else 1 + months * up
    cpp = c["cppAt65"] * cpp_factor
    oas = c["oasAt65"] * (1 + (c["oasAge"] - oas0) * 12 * oas_up)
    if c["cppAge"] == std:
        crossing = None
    else:
        # totals equal: cpp * (x - age) == base * (x - std)  =>  x = (base*std - cpp*age) / (base - cpp)
        crossing = (c["cppAt65"] * std - cpp * c["cppAge"]) / (c["cppAt65"] - cpp)
    income = c["other"] + 12 * (cpp + oas)
    out.append({"input": c, "cppMonthly": float(cpp), "oasMonthly": float(oas),
                "cppCrossing": None if crossing is None else float(crossing), "incomeBothPaid": float(income),
                "aboveThreshold": income > int(thr["value"])})
(here / "fixtures" / "golden.json").write_text(json.dumps({"threshold": thr["id"], "cases": out}, indent=2) + "\n")
for o in out:
    print(o["input"], round(o["cppMonthly"], 2), round(o["oasMonthly"], 2), o["cppCrossing"] and round(o["cppCrossing"], 3),
          round(o["incomeBothPaid"], 2), o["aboveThreshold"])
