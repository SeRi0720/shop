import http from "k6/http";
import { check, fail, sleep } from "k6";

const HOST = __ENV.HOST; // địa chỉ máy ảo (hoặc 127.0.0.1 nếu NAT chuyển tiếp cổng)
const PORTS = (__ENV.PORTS || "3000,3001").split(",");
const BASES = PORTS.map((p) => `http://${HOST}:${p}/api`);
const EMAIL = __ENV.EMAIL || "k6-load@example.com";
const PASSWORD = __ENV.PASSWORD || "K6-load-pass-1";
const JSON_H = { "Content-Type": "application/json" };
const ok = (r) => r.status >= 200 && r.status < 300;

export const options = {
  scenarios: {
    orders: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 20,
      maxDuration: "5m",
    },
  },
  thresholds: { checks: ["rate==1"] },
};

export function setup() {
  const base = BASES[0];
  // Đăng ký lần hai trả lỗi (đã tồn tại): bỏ qua.
  http.post(
    `${base}/auth/register`,
    JSON.stringify({ email: EMAIL, password: PASSWORD, fullName: "K6 Load" }),
    { headers: JSON_H },
  );
  const res = http.post(
    `${base}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: JSON_H },
  );
  if (res.status !== 200) fail(`login lỗi ${res.status}: ${res.body}`);
  return { token: res.json("accessToken") };
}

export default function (data) {
  const base = BASES[__ITER % BASES.length];
  const auth = {
    headers: { ...JSON_H, Authorization: `Bearer ${data.token}` },
  };

  const list = http.get(`${base}/products?limit=50`);
  const items = list.json("items").filter((p) => p.stock >= 1);
  if (items.length === 0) fail("Hết sản phẩm còn hàng");
  const product = items[__ITER % items.length];

  const add = http.post(
    `${base}/cart/items`,
    JSON.stringify({ productId: product.id, quantity: 1 }),
    auth,
  );
  check(add, { "thêm giỏ 2xx": ok });

  const order = http.post(
    `${base}/orders`,
    JSON.stringify({
      shippingName: "K6 Load",
      shippingPhone: "0912345678",
      shippingAddress: "1 Dai Co Viet, Ha Noi",
      paymentMethod: "COD",
    }),
    auth,
  );
  check(order, { "tạo đơn 2xx": ok });
  sleep(1);
}
