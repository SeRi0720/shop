#!/usr/bin/env python3
"""Gộp số giám sát của scripts/t2-monitor-vm.sh theo từng bậc của k6/e2e-ramp.js để tìm nút thắt (T2).
Chạy được ở máy chính hoặc VM (Python 3, không thư viện ngoài).

Dùng: python3 scripts/summarize_t2_monitor.py <thư mục kết quả> --rates 5,10,20,40,80,120,160 [--step 60] [--offset 0]
Đọc: events.txt (mốc START), stats.csv, free.csv, pg.csv, lag.csv trong thư mục.
Ranh giới bậc = START + offset + k*step (START là lúc nginx thấy POST /api/orders đầu tiên, lệch vài giây so với
bậc 0 của k6: chỉnh --offset nếu muốn). Mẫu rơi sau bậc cuối được gộp vào dòng "drain".
Cách đọc nút thắt: xem bảng "Đọc kết quả" trong hướng dẫn ngày 3.
"""
import argparse
import csv
import os
import re
import sys
from collections import defaultdict


def read_csv(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8", errors="replace") as f:
        return [r for r in csv.DictReader(f) if r and None not in r.values()]


def num(s):
    m = re.search(r"[\d.]+", s or "")
    return float(m.group()) if m else 0.0


def mem_mib(s):
    # "123.4MiB / 512MiB" -> lấy phần dùng, quy về MiB
    used = (s or "").split("/")[0].strip()
    v = num(used)
    if "GiB" in used:
        v *= 1024
    elif "KiB" in used or "kB" in used:
        v /= 1024
    return v


def short(name):
    # shop-vm-backend-1-1 -> backend-1
    n = re.sub(r"^shop-vm-", "", name)
    return re.sub(r"-\d+$", "", n)


def main():
    # Windows: stdout qua pipe mặc định cp1252 nên không in được tiếng Việt
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--rates", required=True)
    ap.add_argument("--step", type=int, default=60)
    ap.add_argument("--offset", type=float, default=0)
    ap.add_argument("--out", help="ghi báo cáo ra tệp UTF-8 (nên dùng thay cho Tee-Object trên Windows)")
    a = ap.parse_args()

    if a.out:
        # Ghi thẳng ra tệp UTF-8, không đi qua pipe của PowerShell (pipe làm hỏng tiếng Việt).
        fh = open(a.out, "w", encoding="utf-8")
        console = sys.stdout

        class Tee:
            def write(self, s):
                console.write(s)
                fh.write(s)

            def flush(self):
                console.flush()
                fh.flush()

        sys.stdout = Tee()
    rates = [r.strip() for r in a.rates.split(",")]
    n = len(rates)

    start = None
    with open(os.path.join(a.dir, "events.txt"), encoding="utf-8") as f:
        for line in f:
            p = line.split(None, 1)
            if len(p) == 2 and p[1].strip().startswith("START"):
                start = float(p[0])
    if start is None:
        raise SystemExit("events.txt không có mốc START")
    start += a.offset

    def bucket(ts):
        k = int((float(ts) - start) // a.step)
        return -1 if k < 0 else min(k, n)  # n = drain

    label = lambda k: f"{k} ({rates[k]}/s)" if k < n else "drain"

    # CPU/RAM từng container
    cpu = defaultdict(lambda: defaultdict(list))
    mem = defaultdict(lambda: defaultdict(float))
    for r in read_csv(os.path.join(a.dir, "stats.csv")):
        k = bucket(r["epoch"])
        if k < 0:
            continue
        c = short(r["container"])
        cpu[k][c].append(num(r["cpu"]))
        mem[k][c] = max(mem[k][c], mem_mib(r["mem"]))
    names = sorted({c for k in cpu for c in cpu[k]})
    print("=== CPU% của container (trung bình / lớn nhất; 100% = 1 core) ===")
    print("bậc | " + " | ".join(names))
    print("--- | " + " | ".join("---" for _ in names))
    for k in range(n + 1):
        cells = []
        for c in names:
            v = cpu[k].get(c)
            cells.append(f"{sum(v) / len(v):.0f}/{max(v):.0f}" if v else "-")
        print(f"{label(k)} | " + " | ".join(cells))
    print("\n=== RAM lớn nhất của container (MiB) ===")
    print("bậc | " + " | ".join(names))
    print("--- | " + " | ".join("---" for _ in names))
    for k in range(n + 1):
        print(f"{label(k)} | " + " | ".join(f"{mem[k][c]:.0f}" if c in mem[k] else "-" for c in names))

    # RAM VM
    fr = defaultdict(list)
    sw = defaultdict(float)
    for r in read_csv(os.path.join(a.dir, "free.csv")):
        k = bucket(r["epoch"])
        if k < 0:
            continue
        fr[k].append(float(r["available_mb"]))
        sw[k] = max(sw[k], float(r["swap_used_mb"]))
    print("\n=== RAM VM: available nhỏ nhất (MB) / swap lớn nhất (MB) ; ngưỡng dừng 300 ===")
    for k in range(n + 1):
        if fr[k]:
            print(f"{label(k)} | {min(fr[k]):.0f} | {sw[k]:.0f}")

    # Postgres: số kết nối theo trạng thái, trung bình mỗi lần lấy mẫu
    samples = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # k -> epoch -> key -> count
    for r in read_csv(os.path.join(a.dir, "pg.csv")):
        k = bucket(r["epoch"])
        if k < 0:
            continue
        cnt = int(r["count"])
        e = samples[k][r["epoch"]]
        e["conn_total"] += cnt
        if r["state"] == "active":
            e["active"] += cnt
        if r["state"] == "idle in transaction":
            e["idle_in_tx"] += cnt
        if r["wait_type"] == "Lock":
            e["wait_Lock"] += cnt
        if r["wait_event"] == "ClientRead" and r["state"] == "idle":
            e["idle_clientread"] += cnt
    cols = ["conn_total", "active", "idle_in_tx", "wait_Lock", "idle_clientread"]
    print("\n=== Postgres: số kết nối trung bình mỗi mẫu (wait_Lock > 0 kéo dài = tranh chấp khóa dòng) ===")
    print("bậc | " + " | ".join(cols))
    print("--- | " + " | ".join("---" for _ in cols))
    for k in range(n + 1):
        eps = samples[k]
        if not eps:
            continue
        print(f"{label(k)} | " + " | ".join(f"{sum(e[c] for e in eps.values()) / len(eps):.1f}" for c in cols))

    # Lag và tốc độ vào Kafka (đạo hàm log_end_offset)
    lag = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # k -> (group,topic) -> epoch -> lag tổng
    logend = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for r in read_csv(os.path.join(a.dir, "lag.csv")):
        k = bucket(r["epoch"])
        if k < 0:
            continue
        key = (r["group"].replace("shop.notification-", ""), r["topic"])
        try:
            lag[k][key][r["epoch"]] += int(r["lag"])
            logend[k][key][r["epoch"]] += int(r["log_end_offset"])
        except ValueError:
            pass  # "-" khi chưa có consumer
    keys = sorted({kk for k in lag for kk in lag[k]})
    print("\n=== Consumer lag: lớn nhất trong bậc (tổng các partition) ; msg/s vào topic (từ log-end-offset) ===")
    print("bậc | " + " | ".join(f"{g}:{t}" for g, t in keys))
    print("--- | " + " | ".join("---" for _ in keys))
    for k in range(n + 1):
        cells = []
        for key in keys:
            ls = lag[k].get(key)
            if not ls:
                cells.append("-")
                continue
            eps = sorted(logend[k][key])
            rate = ""
            if len(eps) >= 2:
                dt = float(eps[-1]) - float(eps[0])
                if dt > 0:
                    rate = f" ; {(logend[k][key][eps[-1]] - logend[k][key][eps[0]]) / dt:.0f}/s"
            cells.append(f"{max(ls.values())}{rate}")
        print(f"{label(k)} | " + " | ".join(cells))


if __name__ == "__main__":
    main()