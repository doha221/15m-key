import { fetchKeyCandle, fetchClosedKlines, type ClosedKline } from './binance.ts';
import { initState, classifyBreak, allDone, type Interval } from './monitor.ts';

const SYMBOL = (process.env.SYMBOL ?? 'BTCUSDT').toUpperCase();

function parseDateArg(arg: string | undefined): { y: number; m: number; d: number } {
  if (!arg) {
    const nowVN = new Date(Date.now() + 7 * 3600 * 1000);
    return { y: nowVN.getUTCFullYear(), m: nowVN.getUTCMonth(), d: nowVN.getUTCDate() };
  }
  const match = arg.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`bad date: ${arg} (expect YYYY-MM-DD)`);
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function fmtVN(ms: number): string {
  const d = new Date(ms + 7 * 3600 * 1000);
  return d.toISOString().substring(11, 16);
}

async function main() {
  const dateArg = process.argv[2];
  const { y, m, d } = parseDateArg(dateArg);
  const keyOpenMs = Date.UTC(y, m, d, 0, 0, 0, 0); // 07:00 VN = 00:00 UTC
  const keyCloseMs = keyOpenMs + 15 * 60 * 1000;
  const dateLabel = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;

  if (Date.now() < keyCloseMs) {
    console.error(`Key candle for ${dateLabel} hasn't closed yet (closes at ${new Date(keyCloseMs).toISOString()}).`);
    process.exit(1);
  }

  const key = await fetchKeyCandle(SYMBOL, keyOpenMs);
  console.log(`🔑 Key 15m ${SYMBOL} (07:00 VN, ${dateLabel})`);
  console.log(`   O: ${key.open}  H: ${key.high}  L: ${key.low}  C: ${key.close}\n`);

  const endMs = Date.now();
  const [c3, c5] = await Promise.all([
    fetchClosedKlines(SYMBOL, '3m', keyCloseMs, endMs),
    fetchClosedKlines(SYMBOL, '5m', keyCloseMs, endMs),
  ]);

  const events: Array<ClosedKline & { interval: Interval }> = [
    ...c3.map((c) => ({ ...c, interval: '3m' as const })),
    ...c5.map((c) => ({ ...c, interval: '5m' as const })),
  ].sort((a, b) => a.closeTime - b.closeTime);

  console.log(`Replaying ${c3.length} x 3m + ${c5.length} x 5m candles since 07:15 VN`);
  console.log(`Range: ${key.low} ≤ in_range ≤ ${key.high}\n`);

  let state = initState();
  let notifications = 0;

  for (const ev of events) {
    if (ev.interval === '3m' && state.done3m) continue;
    if (ev.interval === '5m' && state.done5m) continue;
    const res = classifyBreak(state, ev.interval, { high: key.high, low: key.low }, ev.close);
    state = res.state;
    if (res.action === 'in_range') continue;
    notifications++;
    const count = ev.interval === '3m' ? state.count3m : state.count5m;
    const arrow = res.action === 'break_up' ? '📈 UP  ' : '📉 DOWN';
    const ref = res.action === 'break_up' ? `> HIGH ${key.high}` : `< LOW ${key.low}`;
    console.log(`${fmtVN(ev.closeTime)} VN  ${arrow}  ${ev.interval} #${count}  close ${ev.close} ${ref}`);
    if (allDone(state)) {
      console.log(`\n=> both timeframes hit 3 breaks. tool would stop here.`);
      break;
    }
  }

  if (notifications === 0) {
    console.log('No breaks — all 3m/5m candles closed within range.');
  } else {
    console.log(`\nTotal Telegram notifications: ${notifications}`);
    console.log(`Final state: 3m=${state.count3m}/3 (done=${state.done3m})  5m=${state.count5m}/3 (done=${state.done5m})`);
  }
}

main().catch((err) => {
  console.error('[replay] fatal', err);
  process.exit(1);
});
