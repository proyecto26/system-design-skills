#!/usr/bin/env python3
"""Back-of-the-envelope calculator — deterministic sizing for system design.

The one objectively-scriptable surface in this plugin: turn assumptions (DAU,
actions, object size, retention, peak factor) into the numbers that decide an
architecture (QPS, peak QPS, storage/day & total, bandwidth, server count).

Per-server QPS defaults mirror the rules of thumb in
`../references/numbers-to-remember.md` (RDBMS ~1k, KV ~10k, cache ~100k–1M) —
they are CITED here, not a second source of truth; override with --server-qps.
The worked Twitter-scale example in `../references/estimation-recipes.md` is
captured as a golden fixture in `../expected_outputs/twitter_scale.json`.

Stdlib only. Usage:
  python3 botec.py --dau 150e6 --actions 2 --peak 2 --obj-bytes 1e6 \
      --media-frac 0.10 --retention-days 1825 --server-qps 1000 --json
"""
import argparse, json, sys

SECONDS_PER_DAY = 86_400  # ~10^5


def human(n, unit=""):
    """Order-of-magnitude friendly formatting (base-10 for storage/throughput)."""
    for div, suf in ((1e15, "P"), (1e12, "T"), (1e9, "G"), (1e6, "M"), (1e3, "K")):
        if abs(n) >= div:
            return f"{n / div:.1f}{suf}{unit}"
    return f"{n:.0f}{unit}"


def compute(dau, actions, peak, obj_bytes, media_frac, retention_days, server_qps):
    writes_per_day = dau * actions
    qps = writes_per_day / SECONDS_PER_DAY
    peak_qps = qps * peak
    # storage: only objects that are stored (media fraction here; text is negligible)
    bytes_per_day = writes_per_day * media_frac * obj_bytes
    total_bytes = bytes_per_day * retention_days
    bandwidth_bps = peak_qps * obj_bytes  # rough peak ingest of stored objects
    servers = peak_qps / server_qps if server_qps else None
    return {
        "inputs": {
            "dau": dau, "actions_per_user_per_day": actions, "peak_factor": peak,
            "object_bytes": obj_bytes, "media_fraction": media_frac,
            "retention_days": retention_days, "server_qps": server_qps,
        },
        "qps_avg": round(qps),
        "qps_peak": round(peak_qps),
        "storage_per_day_bytes": round(bytes_per_day),
        "storage_total_bytes": round(total_bytes),
        "bandwidth_peak_bytes_per_sec": round(bandwidth_bps),
        "servers_needed": (round(servers) if servers and servers > 0 else None),
        "human": {
            "qps_avg": human(qps), "qps_peak": human(peak_qps),
            "storage_per_day": human(bytes_per_day, "B"),
            "storage_total": human(total_bytes, "B"),
            "bandwidth_peak": human(bandwidth_bps, "B/s"),
            "servers_needed": (str(round(servers)) if servers else "n/a"),
        },
    }


def main(argv=None):
    p = argparse.ArgumentParser(description="Back-of-the-envelope sizing.")
    p.add_argument("--dau", type=float, required=True, help="daily active users (e.g. 150e6)")
    p.add_argument("--actions", type=float, default=1.0, help="write actions / user / day")
    p.add_argument("--peak", type=float, default=2.0, help="peak-to-average factor")
    p.add_argument("--obj-bytes", type=float, default=1e3, help="bytes per stored object")
    p.add_argument("--media-frac", type=float, default=1.0, help="fraction of writes that are stored at obj-bytes")
    p.add_argument("--retention-days", type=float, default=365.0, help="retention window in days")
    p.add_argument("--server-qps", type=float, default=1000.0, help="QPS one server handles (RDBMS~1k, KV~10k, cache~100k+)")
    p.add_argument("--json", action="store_true", help="emit JSON")
    a = p.parse_args(argv)
    r = compute(a.dau, a.actions, a.peak, a.obj_bytes, a.media_frac, a.retention_days, a.server_qps)
    if a.json:
        print(json.dumps(r, indent=2))
    else:
        h = r["human"]
        print(f"avg QPS ~{h['qps_avg']}  peak ~{h['qps_peak']}")
        print(f"storage ~{h['storage_per_day']}/day  ~{h['storage_total']} total")
        print(f"peak bandwidth ~{h['bandwidth_peak']}   servers ~{h['servers_needed']}")
    return r


if __name__ == "__main__":
    main()
