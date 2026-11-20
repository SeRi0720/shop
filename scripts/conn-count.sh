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