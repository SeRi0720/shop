#!/usr/bin/env bash
# CHẠY TRÊN VM (Ubuntu, qua SSH). Không chạy k6: k6 chạy ở MÁY CHÍNH (Windows) vào VM.
# Việc của script (T2): chờ k6 bắt đầu đặt đơn, rồi trong <tổng> giây ghi mỗi ~5 giây
#   CPU/RAM từng container, RAM của VM, trạng thái kết nối Postgres (đang chờ khóa hay chờ client),
#   vmstat; mỗi 15 giây ghi consumer lag của mọi group. Cuối bài đo: OOMKilled/RestartCount, đối chiếu DB.
#
# Dùng: scripts/t2-monitor-vm.sh <nhãn> [tổng=500]     (tổng = các bậc + DRAIN của k6 + ~10 giây)
# Tùy chọn môi trường: T2_OVERRIDE=<tệp compose bổ sung> (vd docker-compose.t2.yml), OUT_DIR, NET, KAFKA_IMAGE.
# Kết quả: $OUT_DIR/<nhãn>/ (mặc định ~/measure/t2/<nhãn>, ngoài repo nên git status vẫn sạch).
#
# Công cụ Kafka chạy trong CONTAINER TẠM (-m 256m, heap 128M), không chạy trong container `kafka`: JVM công cụ
# sẽ thừa hưởng KAFKA_HEAP_OPTS=-Xmx512M của broker và có thể làm container broker vượt mem_limit (bài học T1).
set -euo pipefail
cd "$(dirname "$0")/.."

LABEL="${1:?nhãn, ví dụ off-run1}"
DUR="${2:-500}"
DC="docker compose -f docker-compose.vm.yml${T2_OVERRIDE:+ -f $T2_OVERRIDE}"
NET="${NET:-shop-vm_default}"
KIMG="${KAFKA_IMAGE:-apache/kafka:4.4.0}"
OUT="${OUT_DIR:-$HOME/measure/t2}/${LABEL}"
mkdir -p "$OUT"
EV="$OUT/events.txt"
: > "$EV"
ev() { echo "$(date +%s) $*" | tee -a "$EV"; }
Q() { $DC exec -T postgres psql -U shop -d shop -At -c "$1"; }
K() { docker run --rm -m 256m --network "$NET" -e KAFKA_HEAP_OPTS="-Xmx128M -Xms64M" "$KIMG" "$@"; }
LAG_CMD=(/opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server kafka:29092 --describe --all-groups)
DLT_CMD=(/opt/kafka/bin/kafka-get-offsets.sh --bootstrap-server kafka:29092)

# ---- cấu hình đang chạy: bắt buộc ghi vào báo cáo cho từng lần đo ----
{
  echo "# cấu hình lúc đo ($(date -Is))"
  for b in backend-1 backend-2; do
    echo "$b: $($DC exec -T "$b" sh -c 'echo KAFKA_CONSUMERS_ENABLED=$KAFKA_CONSUMERS_ENABLED DATABASE_POOL_MAX=$DATABASE_POOL_MAX CACHE_ENABLED=$CACHE_ENABLED' | tr -d '\r')"
  done
  echo "web: $($DC exec -T web sh -c 'echo MODSEC_RULE_ENGINE=$MODSEC_RULE_ENGINE LOGIN_RATE=$LOGIN_RATE' | tr -d '\r')"
  echo; echo "# free -m"; free -m
  echo; echo "# df -h /"; df -h /
  echo; $DC ps --format '{{.Service}} {{.Status}}'
} | tee "$OUT/config.txt"

echo; echo "# offset DLT trước khi đo" | tee "$OUT/dlt.txt"
for t in order.created.dlt notification.dlt; do
  K "${DLT_CMD[@]}" --topic "$t" 2>&1 | tee -a "$OUT/dlt.txt" || true
done

# ---- chờ tải từ k6 ----
echo; echo ">>> Bây giờ chạy k6 trên MÁY CHÍNH. Đang chờ thấy POST /api/orders ở nginx (tối đa 600 giây)..."
for i in $(seq 600); do
  # Không dùng `grep -q` trong pipeline: với pipefail, SIGPIPE có thể làm vế `if` sai dù đã khớp.
  if [ -n "$($DC logs --since 3s --no-color web 2>/dev/null | grep -m1 'POST /api/orders' || true)" ]; then break; fi
  [ "$i" -eq 600 ] && { echo "Không thấy tải từ k6. Dừng."; exit 1; }
  sleep 1
done
START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ORDERS_SQL="SELECT count(*) FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email LIKE 'k6-t2-%' AND o.created_at >= '${START_ISO}'"
ev START

# ---- các bộ lấy mẫu chạy nền ----
PIDS=()
cleanup() {
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap ':' INT   # Ctrl-C chỉ ngắt `sleep` bên dưới; phần thu thập cuối vẫn chạy

sample_stats() {
  local ids; ids="$($DC ps -q | tr '\n' ' ')"
  # shellcheck disable=SC2086
  while :; do
    docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' $ids | sed "s/^/$(date +%s),/" || true
    sleep 2
  done
}
sample_free() {
  local line avail
  while :; do
    line="$(free -m | awk -v t="$(date +%s)" '/^Mem:/{u=$3;a=$7} /^Swap:/{s=$3} END{print t","u","a","s}')"
    echo "$line"
    IFS=, read -r _ _ avail _ <<<"$line"
    if [ "${avail:-9999}" -lt 300 ]; then
      echo "!!! available=${avail} MB < 300 MB: DỪNG k6 (Ctrl-C) và ghi vào báo cáo" >&2
      echo "$(date +%s) ALERT available=${avail}" >> "$EV"
    fi
    sleep 5
  done
}
sample_pg() {
  while :; do
    Q "SELECT extract(epoch from now())::bigint, coalesce(state,'-'), coalesce(wait_event_type,'-'), coalesce(wait_event,'-'), count(*) FROM pg_stat_activity WHERE datname='shop' AND pid<>pg_backend_pid() GROUP BY 2,3,4 ORDER BY 2,3,4" 2>/dev/null | tr '|' ',' || true
    sleep 5
  done
}
sample_lag() {
  while :; do
    K "${LAG_CMD[@]}" 2>/dev/null | awk -v t="$(date +%s)" 'NF>=6 && $3 ~ /^[0-9]+$/ {print t","$1","$2","$3","$4","$5","$6}' || true
    sleep 15
  done
}

echo "epoch,container,cpu,mem" > "$OUT/stats.csv";            sample_stats >> "$OUT/stats.csv" 2>&1 & PIDS+=($!)
echo "epoch,used_mb,available_mb,swap_used_mb" > "$OUT/free.csv"; sample_free >> "$OUT/free.csv" & PIDS+=($!)
echo "epoch,state,wait_type,wait_event,count" > "$OUT/pg.csv";  sample_pg >> "$OUT/pg.csv" & PIDS+=($!)
echo "epoch,group,topic,partition,current_offset,log_end_offset,lag" > "$OUT/lag.csv"; sample_lag >> "$OUT/lag.csv" & PIDS+=($!)
vmstat -t 5 > "$OUT/vmstat.txt" & PIDS+=($!)

echo "Đang ghi trong ${DUR} giây (Ctrl-C để dừng sớm)..."
sleep "$DUR" || true
ev END
cleanup
trap - EXIT

# ---- thu thập cuối ----
{
  echo "# free -m sau khi đo"; free -m; echo
  $DC ps --format '{{.Service}} {{.Status}}'
  for s in postgres kafka redis backend-1 backend-2 web; do
    echo "$s OOMKilled/RestartCount: $(docker inspect -f '{{.State.OOMKilled}} {{.RestartCount}}' "$($DC ps -q "$s")")"
  done
  echo; echo "# dmesg (OOM)"
  if out="$(sudo -n dmesg 2>/dev/null)"; then
    echo "$out" | grep -i -E 'out of memory|oom-kill|killed process' || echo "không có dòng OOM"
  else
    echo "không đọc được dmesg ở đây: chạy tay 'sudo dmesg | grep -i oom'"
  fi
  echo; echo "# df -h /"; df -h /
} | tee "$OUT/after.txt"

echo; echo "# offset DLT sau khi đo (so với trước: tăng = có message vào dead-letter)" | tee -a "$OUT/dlt.txt"
for t in order.created.dlt notification.dlt; do
  K "${DLT_CMD[@]}" --topic "$t" 2>&1 | tee -a "$OUT/dlt.txt" || true
done

echo; echo "# lag cuối bài đo (mong đợi 0 sau khi hết DRAIN)" | tee "$OUT/lag-final.txt"
K "${LAG_CMD[@]}" 2>&1 | tee -a "$OUT/lag-final.txt" || true

# Đối chiếu DB với k6: so `orders_ok` trong e2e-summary.json với dòng đầu; hai group phải bằng số đơn.
{
  echo "start_utc=$START_ISO"
  echo "orders_k6t2_since_start=$(Q "$ORDERS_SQL")   # so với tổng orders_ok trong k6"
  echo "order_items_quantity_gt_1=$(Q "SELECT count(*) FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN users u ON u.id=o.user_id WHERE u.email LIKE 'k6-t2-%' AND o.created_at >= '${START_ISO}' AND oi.quantity > 1")"
  echo "# processed_events từ lúc START theo consumer (builder và sender đều phải bằng số đơn nếu không mất/trùng)"
  Q "SELECT consumer, count(*) FROM processed_events WHERE processed_at >= '${START_ISO}' GROUP BY consumer ORDER BY consumer"
} | tee "$OUT/db-check.txt"

$DC logs --no-log-prefix --no-color --since "$START_ISO" web > "$OUT/web.log" 2>&1 || true
echo; echo "Xong. Thư mục: $OUT"
echo "Gợi ý: python3 scripts/analyze_access_log.py chỉ dành cho failover; ở T2 xem stats.csv, pg.csv, lag.csv, vmstat.txt."