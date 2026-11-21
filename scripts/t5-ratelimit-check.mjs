import { createRequire } from "node:module";

const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const { io } = require("socket.io-client"); // devDependency của backend

const { HOST, EMAIL, PASSWORD } = process.env;
const TOTAL = Number(process.env.TOTAL || 20);
if (!HOST || !EMAIL || !PASSWORD) {
  console.error("Thiếu biến môi trường HOST, EMAIL, PASSWORD");
  process.exit(1);
}

const login = await fetch(`https://${HOST}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!login.ok) {
  console.error("Đăng nhập thất bại:", login.status, await login.text());
  process.exit(1);
}
const { accessToken } = await login.json();

const connect = () =>
  new Promise((resolve, reject) => {
    const s = io(`https://${HOST}`, {
      path: "/api/socket.io",
      transports: ["websocket"],
      auth: { token: accessToken },
    });
    s.once("connect", () => resolve(s));
    s.once("connect_error", reject);
  });

const sockets = [await connect(), await connect()];
const send = (s, i) =>
  new Promise((resolve) =>
    s
      .timeout(5000)
      .emit("message:send", { content: `t5-ratelimit #${i}` }, (err, ack) =>
        resolve(err ? { ok: false, code: "TIMEOUT" } : ack),
      ),
  );

const t0 = Date.now();
const counts = {};
for (let i = 1; i <= TOTAL; i++) {
  const ack = await send(sockets[i % 2], i);
  const key = ack.ok ? "OK" : ack.code;
  counts[key] = (counts[key] ?? 0) + 1;
  console.log(`#${String(i).padStart(2)} socket ${i % 2} -> ${key}`);
}
console.log(`\nTổng ${TOTAL} tin trong ${Date.now() - t0} ms:`, counts);
console.log(
  "Mong đợi sau T5: OK=10, RATE_LIMITED=10. Trước T5: OK gần 20 (mỗi backend cho 10).",
);
console.log(
  "Kiểm hai socket ở hai backend: docker compose -f docker-compose.vm.yml logs web | grep socket.io | tail -4  (cột up=)",
);
sockets.forEach((s) => s.close());
