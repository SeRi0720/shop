// Giữ N kết nối Socket.IO (websocket) mở lâu để tạo tải "kết nối dài". Giống trình duyệt thật, VU TỰ KẾT NỐI LẠI
// khi socket bị đứt (backend chết), nên socket của backend chết sẽ dồn sang backend còn sống.
// CHẠY Ở MÁY CHÍNH (PowerShell), trước lượt failover: k6 run -e HOST=192.168.99.144 -e CONNS=40 -e HOLD=600 k6/ws-hold.js
import http from "k6/http";
import ws from "k6/ws";
import { check, fail, sleep } from "k6";

const BASE = __ENV.BASE_URL || `https://${__ENV.HOST}/api`;
const WS_URL =
  (__ENV.WS_URL || `wss://${__ENV.HOST}/api/socket.io/`) +
  "?EIO=4&transport=websocket";
const CONNS = Number(__ENV.CONNS || 40);
const HOLD = Number(__ENV.HOLD || 600); // giây
const EMAIL = "k6-ws@example.com";
const PASSWORD = __ENV.PASSWORD || "K6-load-pass-1";
const JSON_H = { "Content-Type": "application/json" };

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    hold: {
      executor: "per-vu-iterations",
      vus: CONNS,
      iterations: 1,
      maxDuration: `${HOLD + 60}s`,
    },
  },
};

export function setup() {
  http.post(
    `${BASE}/auth/register`,
    JSON.stringify({ email: EMAIL, password: PASSWORD, fullName: "K6 WS" }),
    { headers: JSON_H },
  );
  const r = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: JSON_H },
  );
  if (r.status !== 200) fail(`login lỗi ${r.status}`);
  return { token: r.json("accessToken") };
}

export default function (data) {
  const end = Date.now() + HOLD * 1000;
  while (Date.now() < end) {
    connectOnce(data, end);
    if (Date.now() < end) sleep(1); // chờ 1 giây rồi nối lại, như socket.io-client
  }
}

function connectOnce(data, end) {
  const res = ws.connect(WS_URL, {}, (socket) => {
    socket.on("message", (msg) => {
      if (msg === "2")
        socket.send("3"); // engine.io ping -> pong
      else if (msg.startsWith("0"))
        socket.send("40" + JSON.stringify({ token: data.token })); // mở namespace + auth
    });
    socket.on("error", (e) => console.log("ws error:", e.error()));
    socket.setTimeout(() => socket.close(), Math.max(1, end - Date.now()));
  });
  check(res, { "ws 101": (r) => r && r.status === 101 });
}
