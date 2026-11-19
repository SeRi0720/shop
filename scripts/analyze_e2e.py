#!/usr/bin/env python3
"""Phân tích log của k6/e2e-ramp.js (T2). Chạy được ở máy chính hoặc VM (chỉ cần Python 3, không thư viện ngoài).

Dùng: python3 scripts/analyze_e2e.py <k6-console.log> [--bucket 10] [--csv ra.csv]
Đọc các dòng (k6 --console-output) có dạng:
  time="..." level=info msg="ORD <orderId> <ms phản hồi POST /orders> <bậc>"
  time="..." level=info msg="NTF <orderId> <ms nhận notification:new> <eventId>"
  time="..." level=info msg="WSC <ms> open|close|error ..."
In: (1) bảng theo bậc: số đơn, đã nhận thông báo, chưa nhận, trùng, độ trễ p50/p95/p99/max;
    (2) diễn biến theo cửa sổ thời gian (đối chiếu với lag trong lag.txt của t2-monitor-vm.sh);
    (3) các khoảng WebSocket của admin bị đứt (thông báo rơi vào khoảng này có thể mất vì Socket.IO không phát lại).
Độ trễ = thời điểm nhận NTF đầu tiên - thời điểm nhận phản hồi POST /orders (cùng đồng hồ k6).
Độ trễ âm nghĩa là thông báo tới trước phản hồi HTTP (Kafka nhanh hơn việc dựng phản hồi); vẫn giữ nguyên số âm.
"""
import argparse
import csv
import re
import sys
from collections import defaultdict

LINE = re.compile(r'msg="(ORD|NTF|WSC) ([^"]*)"')


def pct(sorted_vals, p):
    """Nearest-rank trên danh sách đã sắp xếp."""
    if not sorted_vals:
        return None
    k = max(1, int(-(-p * len(sorted_vals) // 100)))  # ceil
    return sorted_vals[min(k, len(sorted_vals)) - 1]


def fmt(x):
    return "-" if x is None else f"{x:.0f}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("log")
    ap.add_argument("--bucket", type=int, default=10, help="giây mỗi cửa sổ ở bảng diễn biến")
    ap.add_argument("--csv", help="ghi từng đơn ra CSV")
    a = ap.parse_args()

    orders = {}  # orderId -> (ts, step)
    ntf = defaultdict(list)  # orderId -> [ts, ...]
    wsc = []  # (ts, kind)
    with open(a.log, encoding="utf-8", errors="replace") as f:
        for line in f:
            m = LINE.search(line)
            if not m:
                continue
            kind, rest = m.group(1), m.group(2).split()
            try:
                if kind == "ORD":
                    orders[int(rest[0])] = (int(rest[1]), int(rest[2]))
                elif kind == "NTF":
                    ntf[int(rest[0])].append(int(rest[1]))
                else:
                    wsc.append((int(rest[0]), rest[1]))
            except (ValueError, IndexError):
                continue

    if not orders:
        sys.exit("Không có dòng ORD nào: kiểm tra đã chạy k6 với --console-output chưa.")

    per_step = defaultdict(lambda: {"n": 0, "got": 0, "dup": 0, "lat": []})
    rows = []
    for oid, (ts, step) in sorted(orders.items()):
        s = per_step[step]
        s["n"] += 1
        times = sorted(ntf.get(oid, []))
        if times:
            s["got"] += 1
            s["dup"] += len(times) - 1
            lat = times[0] - ts
            s["lat"].append(lat)
            rows.append((oid, step, ts, times[0], lat, len(times)))
        else:
            rows.append((oid, step, ts, "", "", 0))

    print("=== Theo bậc ===")
    print("bậc | đơn | có TB | chưa nhận | trùng | p50 | p95 | p99 | max (ms)")
    print("--- | --- | --- | --- | --- | --- | --- | --- | ---")
    tot = {"n": 0, "got": 0, "dup": 0, "lat": []}
    for step in sorted(per_step):
        s = per_step[step]
        lat = sorted(s["lat"])
        print(
            f"{step} | {s['n']} | {s['got']} | {s['n'] - s['got']} | {s['dup']} | "
            f"{fmt(pct(lat, 50))} | {fmt(pct(lat, 95))} | {fmt(pct(lat, 99))} | {fmt(lat[-1] if lat else None)}"
        )
        for k in ("n", "got", "dup"):
            tot[k] += s[k]
        tot["lat"] += s["lat"]
    lat = sorted(tot["lat"])
    print(
        f"all | {tot['n']} | {tot['got']} | {tot['n'] - tot['got']} | {tot['dup']} | "
        f"{fmt(pct(lat, 50))} | {fmt(pct(lat, 95))} | {fmt(pct(lat, 99))} | {fmt(lat[-1] if lat else None)}"
    )
    neg = sum(1 for x in lat if x < 0)
    unknown = [o for o in ntf if o not in orders]
    print(f"\nĐộ trễ âm (thông báo tới trước phản hồi HTTP): {neg}")
    print(f"NTF của đơn không do kịch bản này tạo (vd đơn thật): {len(unknown)}")
    missing = [o for o in orders if o not in ntf]
    if missing:
        print(f"Đơn chưa nhận thông báo: {len(missing)} (id nhỏ nhất {min(missing)}, lớn nhất {max(missing)})")
        print("  -> đối chiếu với processed_events và DLT trong DB/Kafka trước khi kết luận là mất.")

    print(f"\n=== Diễn biến theo cửa sổ {a.bucket}s (theo thời điểm đặt đơn) ===")
    t0 = min(ts for ts, _ in orders.values())
    buckets = defaultdict(list)
    count = defaultdict(int)
    for oid, (ts, _) in orders.items():
        b = (ts - t0) // (a.bucket * 1000)
        count[b] += 1
        if oid in ntf:
            buckets[b].append(min(ntf[oid]) - ts)
    print("t(s) | đơn | p50 | p95 | max (ms)")
    print("--- | --- | --- | --- | ---")
    for b in sorted(count):
        v = sorted(buckets[b])
        print(f"{b * a.bucket} | {count[b]} | {fmt(pct(v, 50))} | {fmt(pct(v, 95))} | {fmt(v[-1] if v else None)}")

    print("\n=== WebSocket của admin ===")
    wsc.sort()
    down_since = None
    gaps = []
    opens = 0
    for ts, kind in wsc:
        if kind == "open":
            opens += 1
            if down_since is not None:
                gaps.append((down_since, ts))
                down_since = None
        elif kind in ("close", "error") and down_since is None:
            down_since = ts
    print(f"Số lần mở: {opens}")
    # Lần đóng cuối cùng là khi bài đo kết thúc, không phải sự cố.
    if gaps:
        for g0, g1 in gaps:
            print(f"Đứt từ +{(g0 - t0) / 1000:.1f}s đến +{(g1 - t0) / 1000:.1f}s (so với đơn đầu tiên)")
    else:
        print("Không có khoảng đứt giữa chừng.")

    if a.csv:
        with open(a.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["orderId", "step", "order_ts_ms", "first_ntf_ts_ms", "latency_ms", "ntf_count"])
            w.writerows(rows)
        print(f"\nĐã ghi {len(rows)} dòng vào {a.csv}")


if __name__ == "__main__":
    main()