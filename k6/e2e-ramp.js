// Kịch bản T2: tăng dần tốc độ đặt đơn (mô hình MỞ) để tìm điểm gãy, đồng thời một admin giữ WebSocket
// để ghi thời điểm nhận `notification:new`. Đo độ trễ đầu-cuối: POST /orders trả về -> admin nhận thông báo.
//
// CHẠY Ở MÁY CHÍNH (PowerShell), thư mục gốc repo:
//   k6 run --console-output=measure\t2\<nhãn>\k6-console.log `
//     -e HOST=192.168.99.144 -e PRODUCT_IDS=1,2,3,4,5,6,7,8,9,10 `
//     -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... k6\e2e-ramp.js *>&1 | Tee-Object measure\t2\<nhãn>\k6-stdout.txt
// Tham số: RATES (đơn/giây mỗi bậc, mặc định 5,10,20,40,80,120,160), STEP (giây mỗi bậc, 60), DRAIN (giây chờ
//   thông báo muộn sau bậc cuối, 60), USERS (số tài khoản, 100), PREFIX (k6-t2), HOT=1 (mọi VU mua CÙNG 1 sản phẩm,
//   lấy phần tử đầu của PRODUCT_IDS: đo tranh chấp khóa dòng), SUMMARY_FILE (nơi ghi JSON tổng kết, mặc định
//   e2e-summary.json ở thư mục hiện tại), BASE_URL / WS_URL (ghi đè khi thử với máy khác).
// Lưu ý: vì có handleSummary nên k6 KHÔNG in bảng tổng kết mặc định; chỉ in bảng theo bậc bên dưới (số đầy đủ nằm trong JSON).
// Điều kiện: LOGIN_RATE nới (vd 1000r/s) vì setup() đăng nhập hàng chục tài khoản; sản phẩm đã nạp tồn kho lớn;
//   tổng thời gian chạy phải nhỏ hơn JWT_ACCESS_EXPIRES_IN (mặc định 15m).
// Hai dòng log do kịch bản ghi (đọc bằng scripts/analyze_e2e.py):
//   ORD <orderId> <ms lúc nhận phản hồi POST /orders> <bậc>
//   NTF <orderId> <ms lúc nhận notification:new> <eventId>
// Cả hai dùng CÙNG đồng hồ của k6 nên không bị lệch giờ giữa máy chính và VM.
import http from "k6/http";
import ws from "k6/ws";
import { check, fail, sleep } from "k6";
import exec from "k6/execution";
import { Counter } from "k6/metrics";

const BASE = __ENV.BASE_URL || `https://${__ENV.HOST}/api`;
const WS_URL =
  (__ENV.WS_URL || `wss://${__ENV.HOST}/api/socket.io/`) +
  "?EIO=4&transport=websocket";
const PASSWORD = __ENV.PASSWORD || "K6-load-pass-1";
const PREFIX = __ENV.PREFIX || "k6-t2";
const N_USERS = Number(__ENV.USERS || 100);
const RATES = (__ENV.RATES || "5,10,20,40,80,120,160")
  .split(",")
  .map((s) => Number(s.trim()));
const STEP = Number(__ENV.STEP || 60); // giây mỗi bậc
const RAMP = Math.min(5, Math.floor(STEP / 4)); // giây đầu mỗi bậc để chuyển tốc độ
const DRAIN = Number(__ENV.DRAIN || 60);
const START_DELAY = 3; // admin nối trước, đơn đầu tiên sau 3 giây
const TOTAL = RATES.length * STEP;
const PRODUCT_IDS = (__ENV.PRODUCT_IDS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);
const HOT = __ENV.HOT === "1";
// ID VU là duy nhất trong cả bài đo, kể cả VU của kịch bản `listener` (1 VU) => chừa 2 chỗ.
const MAX_VUS = N_USERS - 2;
const JSON_H = { "Content-Type": "application/json" };

const ordersOk = new Counter("orders_ok");
const orders409 = new Counter("orders_409");
const orders5xx = new Counter("orders_5xx");
const ordersOther = new Counter("orders_other");
const cartFail = new Counter("cart_fail");

// Ngưỡng "giả" (luôn đúng) chỉ để k6 in số liệu RIÊNG TỪNG BẬC trong báo cáo cuối.
const thresholds = {
  // Ngắt bài đo khi lỗi đơn quá cao để không làm sập VM vô ích.
  "http_req_failed{kind:order}": [
    { threshold: "rate<0.3", abortOnFail: true, delayAbortEval: "20s" },
  ],
};
RATES.forEach((_, s) => {
  thresholds[`http_req_duration{kind:order,step:${s}}`] = ["max>=0"];
  thresholds[`http_req_duration{kind:cart,step:${s}}`] = ["max>=0"];
  thresholds[`orders_ok{step:${s}}`] = ["count>=0"];
  thresholds[`orders_409{step:${s}}`] = ["count>=0"];
  thresholds[`orders_5xx{step:${s}}`] = ["count>=0"];
  thresholds[`orders_other{step:${s}}`] = ["count>=0"];
  thresholds[`cart_fail{step:${s}}`] = ["count>=0"];
});

const stages = [];
for (const r of RATES) {
  stages.push({ target: r, duration: `${RAMP}s` });
  stages.push({ target: r, duration: `${STEP - RAMP}s` });
}

export const options = {
  insecureSkipTLSVerify: true,
  setupTimeout: "300s", // đăng nhập N_USERS tài khoản (argon2) mất vài chục giây đến vài phút
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
  scenarios: {
    listener: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: `${START_DELAY + TOTAL + DRAIN + 30}s`,
      exec: "listener",
    },
    orders: {
      executor: "ramping-arrival-rate",
      startRate: RATES[0],
      timeUnit: "1s",
      stages,
      preAllocatedVUs: MAX_VUS,
      maxVUs: MAX_VUS,
      startTime: `${START_DELAY}s`,
      gracefulStop: "30s",
      exec: "orders",
    },
  },
  thresholds,
};

const login = (email) =>
  http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    {
      headers: JSON_H,
    },
  );

export function setup() {
  if (MAX_VUS < 1) fail("USERS phải >= 3");
  if (PRODUCT_IDS.length === 0) fail("Thiếu PRODUCT_IDS (vd 1,2,3)");
  if (!__ENV.ADMIN_EMAIL || !__ENV.ADMIN_PASSWORD)
    fail(
      "Thiếu ADMIN_EMAIL / ADMIN_PASSWORD (tài khoản admin nghe notification:new)",
    );
  if (TOTAL + DRAIN + 120 > 15 * 60)
    console.warn(
      "Bài đo dài hơn ~13 phút: access token (15m mặc định) có thể hết hạn giữa chừng",
    );

  const ids = HOT ? [PRODUCT_IDS[0]] : PRODUCT_IDS;
  // Số đơn tối đa trên mỗi sản phẩm (cận trên) phải nhỏ hơn tồn kho, nếu không sẽ có 409 giả.
  const maxOrders = RATES.reduce((a, r) => a + r * STEP, 0);
  const perProduct = Math.ceil(maxOrders / ids.length);
  for (const id of ids) {
    const r = http.get(`${BASE}/products/${id}`);
    if (r.status !== 200) fail(`GET /products/${id} lỗi ${r.status}`);
    const stock = r.json("stock");
    if (stock < perProduct * 1.1)
      fail(
        `Sản phẩm ${id} tồn kho ${stock} < ${Math.ceil(perProduct * 1.1)} cần dùng. ` +
          "Nạp thêm tồn kho rồi FLUSHALL Redis (cache chi tiết sản phẩm giữ tới 60 giây).",
      );
  }

  const tokens = [];
  for (let i = 1; i <= N_USERS; i++) {
    const email = `${PREFIX}-${i}@example.com`;
    // Đăng ký lần hai trả lỗi (đã tồn tại): bỏ qua.
    http.post(
      `${BASE}/auth/register`,
      JSON.stringify({ email, password: PASSWORD, fullName: `K6 T2 ${i}` }),
      { headers: JSON_H },
    );
    const res = login(email);
    if (res.status !== 200)
      fail(
        `login ${email} lỗi ${res.status} (429 = LOGIN_RATE quá thấp): ${res.body}`,
      );
    tokens.push(res.json("accessToken"));
  }
  const admin = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({
      email: __ENV.ADMIN_EMAIL,
      password: __ENV.ADMIN_PASSWORD,
    }),
    { headers: JSON_H },
  );
  if (admin.status !== 200) fail(`login admin lỗi ${admin.status}`);

  console.log(
    `CFG rates=${RATES.join("/")} step=${STEP}s users=${N_USERS} maxVUs=${MAX_VUS} hot=${HOT} products=${ids.join(",")}`,
  );
  return { tokens, adminToken: admin.json("accessToken"), ids, t0: Date.now() };
}

// Bậc hiện tại theo thời gian trôi qua kể từ khi kịch bản `orders` bắt đầu.
function stepOf(now, data) {
  const s = Math.floor((now - data.t0 - START_DELAY * 1000) / (STEP * 1000));
  return Math.max(0, Math.min(RATES.length - 1, s));
}

export function orders(data) {
  const idx = exec.vu.idInTest - 1;
  if (idx >= data.tokens.length)
    fail(
      `VU ${exec.vu.idInTest} không có tài khoản riêng: tăng USERS (hiện ${data.tokens.length})`,
    );
  const step = String(stepOf(Date.now(), data));
  const productId = data.ids[idx % data.ids.length];
  const auth = {
    headers: { ...JSON_H, Authorization: `Bearer ${data.tokens[idx]}` },
  };

  const add = http.post(
    `${BASE}/cart/items`,
    JSON.stringify({ productId, quantity: 1 }),
    { ...auth, tags: { kind: "cart", step } },
  );
  // Giỏ không thêm được thì bỏ lượt, KHÔNG gọi tạo đơn.
  if (add.status < 200 || add.status >= 300) {
    cartFail.add(1, { step });
    return;
  }

  const order = http.post(
    `${BASE}/orders`,
    JSON.stringify({
      shippingName: "K6 T2",
      shippingPhone: "0912345678",
      shippingAddress: "1 Dai Co Viet, Ha Noi",
      paymentMethod: "COD",
    }),
    { ...auth, tags: { kind: "order", step } },
  );
  const t = Date.now();
  if (order.status >= 200 && order.status < 300) {
    ordersOk.add(1, { step });
    console.log(`ORD ${order.json("id")} ${t} ${step}`);
  } else if (order.status === 409) {
    orders409.add(1, { step });
  } else if (order.status >= 500) {
    orders5xx.add(1, { step });
  } else {
    ordersOther.add(1, { step });
  }
}

// ---- admin nghe notification:new (Socket.IO qua WebSocket thô, giống k6/ws-hold.js) ----

export function listener(data) {
  const end = Date.now() + (START_DELAY + TOTAL + DRAIN) * 1000;
  while (Date.now() < end) {
    connectOnce(data, end);
    if (Date.now() < end) sleep(1); // như socket.io-client: chờ 1 giây rồi nối lại
  }
}

function connectOnce(data, end) {
  const res = ws.connect(WS_URL, {}, (socket) => {
    socket.on("open", () => console.log(`WSC ${Date.now()} open`));
    socket.on("close", () => console.log(`WSC ${Date.now()} close`));
    socket.on("message", (msg) => {
      const now = Date.now();
      if (msg === "2") {
        socket.send("3"); // engine.io ping -> pong
      } else if (msg.startsWith("0")) {
        socket.send("40" + JSON.stringify({ token: data.adminToken })); // mở namespace + xác thực
      } else if (msg.startsWith("42")) {
        let parsed;
        try {
          parsed = JSON.parse(msg.slice(2));
        } catch {
          return;
        }
        if (parsed[0] === "notification:new" && parsed[1]) {
          console.log(`NTF ${parsed[1].orderId} ${now} ${parsed[1].eventId}`);
        }
      }
    });
    socket.on("error", (e) =>
      console.log(`WSC ${Date.now()} error ${e.error()}`),
    );
    socket.setTimeout(() => socket.close(), Math.max(1, end - Date.now()));
  });
  check(res, { "ws 101": (r) => r && r.status === 101 });
}

// ---- bảng theo từng bậc ở cuối bài đo ----

const v = (data, name, key) => {
  const m = data.metrics[name];
  return m && m.values && m.values[key] !== undefined ? m.values[key] : null;
};
const num = (x, d = 0) => (x === null ? "-" : Number(x).toFixed(d));
const cnt = (data, name) => v(data, name, "count") ?? 0;

export function handleSummary(data) {
  const rows = [
    "bậc | mục tiêu/s | đơn OK | 409 | 5xx | khác | giỏ lỗi | order p50 | p95 | p99 | max (ms) | cart p95",
    "--- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---",
  ];
  RATES.forEach((r, s) => {
    const o = `http_req_duration{kind:order,step:${s}}`;
    const c = `http_req_duration{kind:cart,step:${s}}`;
    rows.push(
      [
        s,
        r,
        cnt(data, `orders_ok{step:${s}}`),
        cnt(data, `orders_409{step:${s}}`),
        cnt(data, `orders_5xx{step:${s}}`),
        cnt(data, `orders_other{step:${s}}`),
        cnt(data, `cart_fail{step:${s}}`),
        num(v(data, o, "med"), 1),
        num(v(data, o, "p(95)"), 1),
        num(v(data, o, "p(99)"), 1),
        num(v(data, o, "max"), 0),
        num(v(data, c, "p(95)"), 1),
      ].join(" | "),
    );
  });
  const dropped = cnt(data, "dropped_iterations");
  const text =
    `\n=== T2: theo từng bậc (mỗi bậc ${STEP}s, hot=${HOT}) ===\n` +
    rows.join("\n") +
    `\ndropped_iterations (hết VU = quá tải): ${dropped}\n` +
    `Đơn đạt/mục tiêu mỗi bậc ≈ (OK+409+5xx+khác) / (mục tiêu x ${STEP}).\n`;
  return {
    stdout: text,
    [__ENV.SUMMARY_FILE || "e2e-summary.json"]: JSON.stringify(data, null, 2),
  };
}
