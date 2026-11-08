import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE = __ENV.BASE_URL || `https://${__ENV.HOST}/api`;

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    read: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || "5m",
    },
  },
  thresholds: { checks: ["rate>0.99"], http_req_failed: ["rate<0.01"] },
};

const QUERIES = [
  "limit=12",
  "limit=12&sort=price_asc",
  "limit=12&sort=price_desc&page=2",
  "limit=12&q=laptop",
  "limit=12&minPrice=5000000&maxPrice=30000000",
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function setup() {
  const list = http.get(`${BASE}/products?limit=50`);
  if (list.status !== 200) fail(`GET /products lỗi ${list.status}`);
  const ids = list.json("items").map((p) => p.id);
  if (ids.length === 0) fail("Không có sản phẩm");
  return { ids };
}

export default function (data) {
  const r1 = http.get(`${BASE}/products?${pick(QUERIES)}`);
  const r2 = http.get(`${BASE}/products/${pick(data.ids)}`);
  const r3 = http.get(`${BASE}/categories`);
  const r4 = http.get(`${BASE}/health`);
  check(r1, { "danh sách 200": (r) => r.status === 200 });
  check(r2, { "chi tiết 200": (r) => r.status === 200 });
  check(r3, { "danh mục 200": (r) => r.status === 200 });
  check(r4, { "health 200": (r) => r.status === 200 });
  sleep(0.5 + Math.random());
}
