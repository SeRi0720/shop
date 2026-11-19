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
const STEP = Number(__ENV.STEP || 60);
const RAMP = Math.min(5, Math.floor(STEP / 4));
const DRAIN = Number(__ENV.DRAIN || 60);
const START_DELAY = 3;
const TOTAL = RATES.length * STEP;
const PRODUCT_IDS = (__ENV.PRODUCT_IDS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);
const HOT = __ENV.HOT === "1";
const MAX_VUS = N_USERS - 2;
const JSON_H = { "Content-Type": "application/json" };

const ordersOk = new Counter("orders_ok");
const orders409 = new Counter("orders_409");
const orders5xx = new Counter("orders_5xx");
const ordersOther = new Counter("orders_other");
const cartFail = new Counter("cart_fail");

const thresholds = {
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
  setupTimeout: "300s",
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
  if (MAX_VUS < 1) fail("USERS must be >= 3");
  if (PRODUCT_IDS.length === 0) fail("Missing PRODUCT_IDS (e.g. 1,2,3)");
  if (!__ENV.ADMIN_EMAIL || !__ENV.ADMIN_PASSWORD)
    fail(
      "Missing ADMIN_EMAIL / ADMIN_PASSWORD (admin account that listens for notification:new)",
    );
  if (TOTAL + DRAIN + 120 > 15 * 60)
    console.warn(
      "Test runs longer than ~13 minutes: the access token (15m by default) may expire midway",
    );

  const ids = HOT ? [PRODUCT_IDS[0]] : PRODUCT_IDS;
  const maxOrders = RATES.reduce((a, r) => a + r * STEP, 0);
  const perProduct = Math.ceil(maxOrders / ids.length);
  for (const id of ids) {
    const r = http.get(`${BASE}/products/${id}`);
    if (r.status !== 200) fail(`GET /products/${id} failed with ${r.status}`);
    const stock = r.json("stock");
    if (stock < perProduct * 1.1)
      fail(
        `Product ${id} has stock ${stock} < ${Math.ceil(perProduct * 1.1)} required. ` +
          "Add more stock, then FLUSHALL Redis (product detail cache is kept for up to 60 seconds).",
      );
  }

  const tokens = [];
  for (let i = 1; i <= N_USERS; i++) {
    const email = `${PREFIX}-${i}@example.com`;
    http.post(
      `${BASE}/auth/register`,
      JSON.stringify({ email, password: PASSWORD, fullName: `K6 T2 ${i}` }),
      { headers: JSON_H },
    );
    const res = login(email);
    if (res.status !== 200)
      fail(
        `login ${email} failed with ${res.status} (429 = LOGIN_RATE too low): ${res.body}`,
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
  if (admin.status !== 200) fail(`admin login failed with ${admin.status}`);

  console.log(
    `CFG rates=${RATES.join("/")} step=${STEP}s users=${N_USERS} maxVUs=${MAX_VUS} hot=${HOT} products=${ids.join(",")}`,
  );
  return { tokens, adminToken: admin.json("accessToken"), ids, t0: Date.now() };
}

function stepOf(now, data) {
  const s = Math.floor((now - data.t0 - START_DELAY * 1000) / (STEP * 1000));
  return Math.max(0, Math.min(RATES.length - 1, s));
}

export function orders(data) {
  const idx = exec.vu.idInTest - 1;
  if (idx >= data.tokens.length)
    fail(
      `VU ${exec.vu.idInTest} has no dedicated account: increase USERS (currently ${data.tokens.length})`,
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

export function listener(data) {
  const end = Date.now() + (START_DELAY + TOTAL + DRAIN) * 1000;
  while (Date.now() < end) {
    connectOnce(data, end);
    if (Date.now() < end) sleep(1);
  }
}

function connectOnce(data, end) {
  const res = ws.connect(WS_URL, {}, (socket) => {
    socket.on("open", () => console.log(`WSC ${Date.now()} open`));
    socket.on("close", () => console.log(`WSC ${Date.now()} close`));
    socket.on("message", (msg) => {
      const now = Date.now();
      if (msg === "2") {
        socket.send("3");
      } else if (msg.startsWith("0")) {
        socket.send("40" + JSON.stringify({ token: data.adminToken }));
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

const v = (data, name, key) => {
  const m = data.metrics[name];
  return m && m.values && m.values[key] !== undefined ? m.values[key] : null;
};
const num = (x, d = 0) => (x === null ? "-" : Number(x).toFixed(d));
const cnt = (data, name) => v(data, name, "count") ?? 0;

export function handleSummary(data) {
  const rows = [
    "step | target/s | orders OK | 409 | 5xx | other | cart failed | order p50 | p95 | p99 | max (ms) | cart p95",
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
    `\n=== T2: per step (${STEP}s each, hot=${HOT}) ===\n` +
    rows.join("\n") +
    `\ndropped_iterations (out of VUs = overload): ${dropped}\n` +
    `Achieved/target orders per step ≈ (OK+409+5xx+other) / (target x ${STEP}).\n`;
  return {
    stdout: text,
    [__ENV.SUMMARY_FILE || "e2e-summary.json"]: JSON.stringify(data, null, 2),
  };
}
