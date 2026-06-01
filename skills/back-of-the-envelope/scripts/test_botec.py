#!/usr/bin/env python3
"""Golden-fixture assertion for botec.py. Run: python3 scripts/test_botec.py
Recomputes the Twitter-scale example and diffs against expected_outputs/twitter_scale.json,
keeping the prose worked example (references/estimation-recipes.md) and the calculator in sync.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from botec import compute  # noqa: E402

HERE = os.path.dirname(__file__)
golden = json.load(open(os.path.join(HERE, "..", "expected_outputs", "twitter_scale.json")))
got = compute(150e6, 2, 2, 1e6, 0.10, 1825, 1000)
keys = ["qps_avg", "qps_peak", "storage_per_day_bytes", "storage_total_bytes", "servers_needed"]
diff = {k: (golden[k], got[k]) for k in keys if golden[k] != got[k]}
if diff:
    print("FAIL — calculator drifted from golden fixture:", json.dumps(diff, indent=2))
    sys.exit(1)
print("OK — botec.py matches twitter_scale.json (qps_avg=%d peak=%d servers=%s)"
      % (got["qps_avg"], got["qps_peak"], got["servers_needed"]))
