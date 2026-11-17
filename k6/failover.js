// Kịch bản T3: tải GET + POST liên tục để quan sát failover nginx.
// CHẠY Ở MÁY CHÍNH (PowerShell): k6 run -e HOST=192.168.99.144 -e PRODUCT_ID=1 k6\failover.js
// Tham số: USERS (mặc định 72), ORDER_VUS (8), PRODUCT_ID, DURATION, READ_RATE, ORDER_RATE.
// Cần: LOGIN_RATE nới (vd 1000r/s) trong .env của VM; mặc định 5r/m chặn đăng nhập hàng loạt ở setup.
import http from "k6/http";
import { check, fail, sleep } from "k6";
import exec from "k6/execution";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE_URL || `https://${__ENV.HOST}/api`;
const PASSWORD = __ENV.PASSWORD || "K6-load-pass-1";
// Mỗi VU dùng 1 tài khoản RIÊNG theo exec.vu.idInTest. ID VU không gắn với scenario (k6 lấy VU từ một pool chung),
// nên KHÔNG dùng modulo: hai VU trùng tài khoản sẽ tranh giỏ hàng (đơn quantity=2 và 409 giả ở lượt rr-ws-kill).
// Cần USERS >= tổng số VU tối đa (reads maxVUs 60 + orders ORDER_VUS) để mọi VU có tài khoản riêng.
const ORDER_VUS = Number(__ENV.ORDER_VUS || 8);
const N_USERS = Number(__ENV.USERS || 72);
const DURATION = __ENV.DURATION || "150s";
const READ_RATE = Number(__ENV.READ_RATE || 30); // req/s
const ORDER_RATE = Number(__ENV.ORDER_RATE || 4); // đơn/s
const PRODUCT_ID = Number(__ENV.PRODUCT_ID || 0); // sản phẩm đã nạp tồn kho lớn
const JSON_H = { "Content-Type": "application/json" };

export const options = {
  insecureSkipTLSVerify: true,
  setupTimeout: "180s", // đăng ký + đăng nhập N_USERS tài khoản (argon2) mất vài chục giây
  scenarios: {
    reads: {
      executor: "constant-arrival-rate",
      rate: READ_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: 20,
      maxVUs: 60,
      exec: "reads",
    },
    orders: {
      executor: "constant-arrival-rate",
      rate: ORDER_RATE,
      timeUnit: "1s",
      duration: DURATION,
      preAllocatedVUs: ORDER_VUS,
      maxVUs: ORDER_VUS,
      exec: "orders",
    },
  },
  // Không đặt ngưỡng fail: mục tiêu là ĐO lỗi, không phải bắt test fail.
};

export const orderCreated = new Counter("orders_created_2xx");
export const order409 = new Counter("orders_409");
export const order5xx = new Counter("orders_5xx");
export const cartAdd5xx = new Counter("cart_add_5xx");

export function setup() {
  const tokens = [];
  for (let i = 1; i <= N_USERS; i++) {
    const email = `k6-fo-${i}@example.com`;
    // Đăng ký lần hai trả lỗi (đã tồn tại): bỏ qua.
    http.post(
      `${BASE}/auth/register`,
      JSON.stringify({ email, password: PASSWORD, fullName: `K6 FO ${i}` }),
      { headers: JSON_H },
    );
    const res = http.post(
      `${BASE}/auth/login`,
      JSON.stringify({ email, password: PASSWORD }),
      { headers: JSON_H },
    );
    if (res.status !== 200)
      fail(
        `login ${email} lỗi ${res.status} (429 = LOGIN_RATE quá thấp): ${res.body}`,
      );
    tokens.push(res.json("accessToken"));
  }
  let productId = PRODUCT_ID;
  if (!productId) {
    const list = http.get(`${BASE}/products?limit=50`);
    const best = list.json("items").sort((a, b) => b.stock - a.stock)[0];
    if (!best || best.stock < 1000)
      fail(
        "Cần PRODUCT_ID của sản phẩm có tồn kho >= 1000 (xem bước nạp tồn kho)",
      );
    productId = best.id;
  }
  const ids = http
    .get(`${BASE}/products?limit=50`)
    .json("items")
    .map((p) => p.id);
  return { tokens, productId, ids };
}

export function reads(data) {
  const id = data.ids[Math.floor(Math.random() * data.ids.length)];
  const a = http.get(`${BASE}/products?limit=12`, { tags: { kind: "read" } });
  const b = http.get(`${BASE}/products/${id}`, { tags: { kind: "read" } });
  check(a, { "list 200": (r) => r.status === 200 });
  check(b, { "detail 200": (r) => r.status === 200 });
}

export function orders(data) {
  const idx = exec.vu.idInTest - 1;
  if (idx >= data.tokens.length)
    fail(
      `VU ${exec.vu.idInTest} không có tài khoản riêng: tăng USERS (hiện ${data.tokens.length})`,
    );
  const token = data.tokens[idx];
  const auth = { headers: { ...JSON_H, Authorization: `Bearer ${token}` } };

  const add = http.post(
    `${BASE}/cart/items`,
    JSON.stringify({ productId: data.productId, quantity: 1 }),
    { ...auth, tags: { kind: "cart_add" } },
  );
  if (add.status >= 500) cartAdd5xx.add(1);
  // Giỏ không thêm được (5xx) thì bỏ lượt, KHÔNG gọi tạo đơn.
  if (add.status < 200 || add.status >= 300) return;

  const order = http.post(
    `${BASE}/orders`,
    JSON.stringify({
      shippingName: "K6 Failover",
      shippingPhone: "0912345678",
      shippingAddress: "1 Dai Co Viet, Ha Noi",
      paymentMethod: "COD",
    }),
    { ...auth, tags: { kind: "order" } },
  );
  if (order.status >= 200 && order.status < 300) orderCreated.add(1);
  else if (order.status === 409) order409.add(1);
  else if (order.status >= 500) order5xx.add(1);
  sleep(0.05);
}
