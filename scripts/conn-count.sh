#!/usr/bin/env bash
# CHẠY TRÊN VM. Đếm kết nối TCP ESTABLISHED tới cổng 3000 trong từng backend (cả IPv4/IPv6), mỗi 5 giây.
# Gồm cả kết nối keepalive nhàn rỗi của nginx; kết nối WebSocket là phần chênh lệch ổn định.
# Dùng: scripts/conn-count.sh [số_lần=24]  (ghi thêm vào stdout dạng: giờ backend-1 backend-2)
cd "$(dirname "$0")/.."
DC="docker compose -f docker-compose.vm.yml"
N="${1:-24}"
count() {
  $DC exec -T "$1" sh -c "cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | awk '\$2 ~ /:0BB8\$/ && \$4==\"01\"' | wc -l" | tr -d '\r'
}
for _ in $(seq "$N"); do
  echo "$(date +%T) backend-1=$(count backend-1) backend-2=$(count backend-2)"
  sleep 5
done