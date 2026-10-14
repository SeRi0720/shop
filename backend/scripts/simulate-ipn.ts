// Giả lập IPN của VNPay (có ký bằng khóa trong .env) để test không cần tunnel.
// Chạy từ thư mục backend:
//   npx tsx scripts/simulate-ipn.ts --txnRef <mã> --amount <VND> [--fail] [--wrong-amount] [--tamper] [--base http://localhost:3000]
import 'dotenv/config';
import { createHmac } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const has = (name: string) => argv.includes(`--${name}`);

// Cùng quy tắc mã hóa với VnpayService (giống urlencode của PHP).
const urlEncode = (v: string) =>
  encodeURIComponent(v)
    .replace(
      /[!'()*~]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%20/g, '+');

const p2 = (n: number) => String(n).padStart(2, '0');
function vnNow(): string {
  const t = new Date(Date.now() + 7 * 3600_000);
  return (
    `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}` +
    `${p2(t.getUTCHours())}${p2(t.getUTCMinutes())}${p2(t.getUTCSeconds())}`
  );
}

async function main() {
  const txnRef = opt('txnRef');
  const amount = Number(opt('amount'));
  const tmnCode = process.env.VNPAY_TMN_CODE;
  const secret = process.env.VNPAY_HASH_SECRET;
  if (
    !txnRef ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    !tmnCode ||
    !secret
  ) {
    console.error(
      'Dùng: npx tsx scripts/simulate-ipn.ts --txnRef <mã> --amount <VND> [--fail] [--wrong-amount] [--tamper] [--base <url>]\n' +
        'Cần VNPAY_TMN_CODE và VNPAY_HASH_SECRET trong .env',
    );
    process.exit(1);
  }

  const fail = has('fail');
  const params: Record<string, string> = {
    vnp_Amount: String((amount + (has('wrong-amount') ? 1 : 0)) * 100),
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'VNP00000001',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: 'Thanh toan don hang gia lap IPN',
    vnp_PayDate: vnNow(),
    vnp_ResponseCode: fail ? '24' : '00',
    vnp_TmnCode: tmnCode,
    vnp_TransactionNo: opt('transactionNo') ?? '99999999',
    vnp_TransactionStatus: fail ? '02' : '00',
    vnp_TxnRef: txnRef,
  };
  const data = Object.keys(params)
    .sort()
    .map((k) => `${urlEncode(k)}=${urlEncode(params[k])}`)
    .join('&');
  const hash = createHmac('sha512', secret).update(data, 'utf8').digest('hex');
  let query = `${data}&vnp_SecureHash=${hash}`;
  // --tamper: sửa số tiền SAU khi ký, chữ ký phải bị từ chối (97)
  if (has('tamper')) query = query.replace(/vnp_Amount=\d+/, 'vnp_Amount=100');

  const base = opt('base') ?? 'http://localhost:3000';
  const res = await fetch(`${base}/api/payments/vnpay/ipn?${query}`);
  console.log(res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
