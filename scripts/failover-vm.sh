#!/usr/bin/env bash
# CHẠY TRÊN VM (Ubuntu, qua SSH). Không chạy k6: k6 chạy ở MÁY CHÍNH (Windows) vào VM.
# Việc của script: chờ tải từ k6 xuất hiện ở nginx, rồi dừng/khởi động lại backend-1 đúng giờ,
# ghi mốc thời gian (đồng hồ VM) và gom log + số đơn trong DB.
#
# Dùng: scripts/failover-vm.sh <stop|kill> <nhãn> [t_down=30] [t_up=60] [tổng=150]
# Kết quả: $OUT_DIR/<nhãn>/ (mặc định ~/measure/failover/<nhãn>, ngoài repo nên git status vẫn sạch)
set -euo pipefail
cd "$(dirname "$0")/.."   # về thư mục gốc repo trên VM (nơi có docker-compose.vm.yml)

MODE="${1:?stop|kill}"; LABEL="${2:?nhãn, ví dụ baseline-kill}"
T_DOWN="${3:-30}"; T_UP="${4:-60}"; TOTAL="${5:-150}"
[[ "$MODE" == stop || "$MODE" == kill ]] || { echo "MODE phải là stop hoặc kill"; exit 1; }
DC="docker compose -f docker-compose.vm.yml"
OUT="${OUT_DIR:-$HOME/measure/failover}/${LABEL}"; mkdir -p "$OUT"
EV="$OUT/events.txt"; : > "$EV"
ev() { echo "$(date +%s.%N) $*" | tee -a "$EV"; }
ips() { docker inspect -f '{{.Name}} {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$($DC ps -q "$1")"; }

{ echo "# free -m (VM) trước khi đo"; free -m; echo; $DC ps --format '{{.Service}} {{.Status}}'; } | tee "$OUT/before.txt"
{ ips backend-1; ips backend-2; } | tee "$OUT/backend-ips.txt"

Q() { $DC exec -T postgres psql -U shop -d shop -At -c "$1"; }
ORDERS_SQL="SELECT count(*) FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email LIKE 'k6-fo-%'"
ORDERS_BEFORE="$(Q "$ORDERS_SQL")"; echo "orders_k6fo_total_before=$ORDERS_BEFORE" | tee "$OUT/db-before.txt"
echo
echo ">>> Bây giờ chạy k6 trên MÁY CHÍNH. Đang chờ thấy POST /api/orders ở nginx (tối đa 180 giây)..."
for i in $(seq 180); do
  if $DC logs --since 3s --no-color web 2>/dev/null | grep -q 'POST /api/orders'; then break; fi
  [ "$i" -eq 180 ] && { echo "Không thấy tải từ k6. Dừng."; exit 1; }
  sleep 1
done

START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ev START
sleep "$T_DOWN"
ev "DOWN backend-1 mode=$MODE"
if [ "$MODE" = kill ]; then $DC kill backend-1 >/dev/null; else $DC stop backend-1 >/dev/null; fi

sleep $((T_UP - T_DOWN))
ev "UP backend-1 (start)"
$DC start backend-1 >/dev/null
ips backend-1 >> "$OUT/backend-ips.txt"   # Docker có thể cấp IP khác sau khi sống lại; bộ phân tích gộp theo tên

sleep $((TOTAL - T_UP + 5))
ev END
{ echo "# free -m (VM) sau khi đo"; free -m; echo; $DC ps --format '{{.Service}} {{.Status}}'
  for s in backend-1 backend-2 web; do
    echo "$s OOMKilled/RestartCount: $(docker inspect -f '{{.State.OOMKilled}} {{.RestartCount}}' "$($DC ps -q $s)")"
  done; } | tee "$OUT/after.txt"

$DC logs --no-log-prefix --no-color --since "$START_ISO" web > "$OUT/web.log" 2>&1 || true
$DC logs --no-log-prefix --no-color --since "$START_ISO" backend-1 > "$OUT/backend-1.log" 2>&1 || true
$DC logs --no-log-prefix --no-color --since "$START_ISO" backend-2 > "$OUT/backend-2.log" 2>&1 || true

# Đối chiếu DB với k6-summary.json (trên máy chính): đơn thiếu/thừa và dòng đơn có quantity > 1 (dấu hiệu cart add bị retry).
{
  echo "orders_k6fo_total_before=$ORDERS_BEFORE"
  echo "orders_k6fo_total_after=$(Q "$ORDERS_SQL")"
  echo "orders_k6fo_delta=$(( $(Q "$ORDERS_SQL") - ORDERS_BEFORE ))   # so với orders_created_2xx trong k6-summary.json"
  echo "orders_k6fo_since_start=$(Q "SELECT count(*) FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email LIKE 'k6-fo-%' AND o.created_at >= '${START_ISO}'")"
  echo "order_items_quantity_gt_1=$(Q "SELECT count(*) FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN users u ON u.id=o.user_id WHERE u.email LIKE 'k6-fo-%' AND o.created_at >= '${START_ISO}' AND oi.quantity > 1")"
} | tee "$OUT/db-check.txt"

echo; echo "Xong. Phân tích (trên VM): python3 scripts/analyze_access_log.py $OUT"