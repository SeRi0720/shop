set -euo pipefail
cd "$(dirname "$0")/.."

LABEL="${1:?nhãn, ví dụ t4-stop}"
INTERVAL="${2:-5}"
DC="docker compose -f docker-compose.vm.yml"
NET="${NET:-shop-vm_default}"
KIMG="${KIMG:-apache/kafka:4.4.0}"
OUT="${OUT_DIR:-$HOME/measure/t4}/${LABEL}"
mkdir -p "$OUT"; : > "$OUT/summary.txt"; : > "$OUT/raw.txt"

T=t4-tools
CG=/opt/kafka/bin/kafka-consumer-groups.sh
GO=/opt/kafka/bin/kafka-get-offsets.sh
BROKER=kafka:29092

# Một container công cụ sống suốt bài đo; mỗi lần exec chỉ chạy một JVM ngắn.
docker rm -f "$T" >/dev/null 2>&1 || true
docker run -d --name "$T" -m 256m --network "$NET" \
  -e KAFKA_HEAP_OPTS="-Xmx128M -Xms64M" --entrypoint sleep "$KIMG" infinity >/dev/null

Q() { $DC exec -T postgres psql -U shop -d shop -At -c "$1"; }
sumoff() { docker exec "$T" "$GO" --bootstrap-server "$BROKER" --topic "$1" | awk -F: '{s+=$3} END{print s+0}'; }

snapshot() { # $1 = before | after
  {
    echo "time=$(date -Is)"
    echo "orders_k6fo=$(Q "SELECT count(*) FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email LIKE 'k6-fo-%'")"
    Q "SELECT 'processed_'||consumer||'='||count(*) FROM processed_events GROUP BY consumer ORDER BY 1"
    for t in order.created notification order.created.dlt notification.dlt; do
      echo "end_offset_${t}=$(sumoff "$t")"
    done
    echo; echo "# free -m"; free -m
  } | tee "$OUT/$1.txt"
}

snap_group() { # $1 = group
  local g="$1" ts raw
  ts=$(date +%s.%N)
  raw=$(docker exec "$T" "$CG" --bootstrap-server "$BROKER" --describe --group "$g" 2>&1 || true)
  echo "$raw" | sed "s/^/$ts /" >> "$OUT/raw.txt"
  # Cột: GROUP TOPIC PARTITION CURRENT-OFFSET LOG-END-OFFSET LAG CONSUMER-ID HOST CLIENT-ID
  echo "$raw" | awk -v ts="$ts" -v g="$g" '
    $1==g && $3 ~ /^[0-9]+$/ { c=$9; sub(/^shop-backend-/,"",c); o=o" "$3":"c; lag+=$6 }
    /rebalanc/ { rb=" REBALANCING" }
    END { printf "%s %s owners=[%s ] lag=%d%s\n", ts, g, o, lag, rb }' | tee -a "$OUT/summary.txt"
}

finish() {
  trap - INT TERM
  echo; echo "--- kết thúc: chụp số liệu sau ---"
  snapshot after || true
  docker rm -f "$T" >/dev/null 2>&1 || true
  echo "Kết quả ở $OUT"
  exit 0
}
trap finish INT TERM

snapshot before
echo
echo ">>> Đang lấy mẫu mỗi ${INTERVAL}s. Bây giờ chạy failover-vm.sh (SSH 2) và k6 (máy chính)."
echo ">>> Bấm Ctrl-C khi k6 xong và lag của cả hai group về 0."
while true; do
  snap_group shop.notification-builder
  snap_group shop.notification-sender
  sleep "$INTERVAL"
done