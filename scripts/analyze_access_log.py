import re, sys, os
from collections import defaultdict, Counter
from datetime import datetime

LINE = re.compile(
    r'^(\S+) \[([^\]]+)\] "([^"]*)" (\d{3}) (\d+) rt=(\S+) up=(.*?) urt=(.*)$'
)

def load_events(path):
    ev = []
    if os.path.exists(path):
        for l in open(path):
            p = l.split(None, 1)
            if len(p) == 2:
                ev.append((float(p[0]), p[1].strip()))
    return ev

def load_ips(path):
    ips = {}
    if os.path.exists(path):
        for l in open(path):
            p = l.split()
            if len(p) == 2:
                ips[p[1]] = p[0].lstrip("/").replace("shop-vm-", "").rsplit("-", 1)[0]
    return ips

def main(d):
    ev = load_events(f"{d}/events.txt")
    ips = load_ips(f"{d}/backend-ips.txt")
    t0 = ev[0][0] if ev else None
    rows = defaultdict(lambda: Counter())
    seen_ups = Counter()
    post_fail = []
    first_5xx = last_5xx = None
    times = {}  # tên backend -> danh sách epoch các request nhận được

    for raw in open(f"{d}/web.log", errors="replace"):
        m = LINE.match(raw.strip())
        if not m:
            continue
        _, ts, req, status, _, rt, up, urt = m.groups()
        if "/api/" not in req:
            continue
        t = datetime.strptime(ts, "%d/%b/%Y:%H:%M:%S %z").timestamp()
        sec = int(t - t0) if t0 else int(t)
        c = rows[sec]
        c["total"] += 1
        st = int(status)
        c["2xx" if st < 300 else "4xx" if st < 500 else "5xx"] += 1
        addrs = [a.strip() for a in up.split(",") if a.strip() and a.strip() != "-"]
        if len(addrs) > 1:
            c["retry"] += 1
        for a in addrs:
            host = a.split(":")[0]
            name = ips.get(host, host)
            c[name] += 1
            seen_ups[name] += 1
            times.setdefault(name, []).append(t)
        if st >= 500:
            first_5xx = t if first_5xx is None else first_5xx
            last_5xx = t
            if req.startswith(("POST", "PATCH", "PUT", "DELETE")):
                post_fail.append((sec, req, status, up, urt))

    names = sorted(seen_ups)
    print(f"{'giây':>5} {'tổng':>5} {'2xx':>5} {'4xx':>4} {'5xx':>4} {'retry':>5} " + " ".join(f"{n:>10}" for n in names))
    for s in sorted(rows):
        c = rows[s]
        mark = ""
        for et, name in ev:
            if t0 is not None and int(et - t0) == s:
                mark += f"  <-- {name}"
        print(f"{s:>5} {c['total']:>5} {c['2xx']:>5} {c['4xx']:>4} {c['5xx']:>4} {c['retry']:>5} "
              + " ".join(f"{c[n]:>10}" for n in names) + mark)

    print("\n== Tổng kết ==")
    tot = sum(r["total"] for r in rows.values())
    e5 = sum(r["5xx"] for r in rows.values())
    rt = sum(r["retry"] for r in rows.values())
    print(f"Tổng request /api: {tot}; 5xx: {e5} ({100*e5/max(tot,1):.2f}%); được nginx thử lại (retry): {rt}")
    if first_5xx:
        print(f"5xx đầu tiên: +{first_5xx - t0:.1f}s; cuối cùng: +{last_5xx - t0:.1f}s (kéo dài {last_5xx-first_5xx:.1f}s)")
    else:
        print("Không có 5xx nào.")
    down = next((t for t, n in ev if n.startswith("DOWN")), None)
    up_ = next((t for t, n in ev if n.startswith("UP")), None)
    b1 = times.get("backend-1", [])
    if b1 and down:
        before = [x for x in b1 if x >= down and (not up_ or x < up_)]
        last_dead = max(before) if before else None
        print(f"DOWN lúc +{down-t0:.1f}s. Request CUỐI gửi tới backend-1 trong lúc chết: "
              + (f"+{last_dead-t0:.1f}s (nginx còn gửi vào backend chết {last_dead-down:.1f}s sau khi nó chết)" if last_dead else "không có (nginx loại ngay)"))
    if b1 and up_:
        after = sorted(x for x in b1 if x >= up_)
        if after:
            first = after[0]
            print(f"UP lúc +{up_-t0:.1f}s. backend-1 nhận request đầu tiên sau đó: +{first-t0:.1f}s (chậm {first-up_:.1f}s)")
            for w in (5, 10):
                n1 = sum(1 for x in after if x < first + w)
                n2 = sum(1 for x in times.get("backend-2", []) if first <= x < first + w)
                print(f"  {w}s đầu sau khi nhận lại: backend-1={n1}, backend-2={n2}")
        else:
            print(f"UP lúc +{up_-t0:.1f}s nhưng backend-1 KHÔNG nhận request nào sau đó.")
    if post_fail:
        print(f"\nRequest ghi (POST/PATCH/PUT/DELETE) bị 5xx: {len(post_fail)}")
        for s, rq, st, up, urt in post_fail[:15]:
            print(f"  +{s}s {rq} -> {st} up={up} urt={urt}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1].rstrip("/"))