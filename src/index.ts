import cron from 'node-cron';
import { loadConfig } from './config.ts';
import { createTelegramClient } from './telegram.ts';
import { fetchKeyCandle, fetchClosedKlines, type Kline } from './binance.ts';
import { initState, classifyBreak, allDone, type BreakState, type KeyRange, type Interval } from './monitor.ts';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const POLL_INTERVAL_MS = 30_000;

function formatKeyMessage(symbol: string, k: Kline): string {
  const d = new Date(k.openTime);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return [
    `🔑 Key 15m ${symbol} (07:00 VN, ${dd}/${mm}/${yyyy})`,
    `O: ${k.open}  H: ${k.high}`,
    `L: ${k.low}  C: ${k.close}`,
  ].join('\n');
}

function formatBreakMessage(interval: Interval, action: 'break_up' | 'break_down', close: number, key: KeyRange, count: number): string {
  if (action === 'break_up') {
    return `📈 ${interval} break UP #${count}\nclose ${close} > HIGH ${key.high}`;
  }
  return `📉 ${interval} break DOWN #${count}\nclose ${close} < LOW ${key.low}`;
}

// Returns the UTC openTime ms of the 15m candle that started at 07:00 VN today.
// 07:00 VN == 00:00 UTC. Implementation: take "now" in VN, snap to today's 00:00 UTC.
function todaysKeyOpenTimeMs(now: Date = new Date()): number {
  // 07:00 VN today == 00:00 UTC today
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  return utc.getTime();
}

async function runOnce(config: ReturnType<typeof loadConfig>) {
  const tg = createTelegramClient(config.telegramBotToken, config.telegramChatId, config.dryRun);

  const openTimeMs = todaysKeyOpenTimeMs();
  let key: Kline;
  try {
    key = await fetchKeyCandle(config.symbol, openTimeMs);
  } catch (err) {
    console.error('[main] fetchKeyCandle failed', err);
    await tg.send(`⚠️ ${config.symbol}: failed to fetch 07:00 VN 15m candle. Skipping today.`);
    return;
  }

  await tg.send(formatKeyMessage(config.symbol, key));

  let state: BreakState = initState();
  const keyRange: KeyRange = { high: key.high, low: key.low };
  const keyCloseMs = openTimeMs + 15 * 60 * 1000;
  const lastSeenCloseTime: Record<Interval, number> = {
    '3m': keyCloseMs - 1,
    '5m': keyCloseMs - 1,
  };

  const handleClose = async (interval: Interval, close: number) => {
    if (interval === '3m' && state.done3m) return;
    if (interval === '5m' && state.done5m) return;

    const res = classifyBreak(state, interval, keyRange, close);
    state = res.state;
    if (res.action === 'in_range') return;

    const count = interval === '3m' ? state.count3m : state.count5m;
    await tg.send(formatBreakMessage(interval, res.action, close, keyRange, count));

    if (allDone(state)) {
      console.log('[main] both timeframes done; stopping poll');
    }
  };

  let timer: NodeJS.Timeout | null = null;

  const poll = async () => {
    if (allDone(state)) {
      if (timer) { clearInterval(timer); timer = null; }
      return;
    }
    const now = Date.now();
    for (const interval of ['3m', '5m'] as const) {
      if (interval === '3m' && state.done3m) continue;
      if (interval === '5m' && state.done5m) continue;
      try {
        const candles = await fetchClosedKlines(config.symbol, interval, lastSeenCloseTime[interval] + 1, now);
        for (const c of candles) {
          if (c.closeTime <= lastSeenCloseTime[interval]) continue;
          lastSeenCloseTime[interval] = c.closeTime;
          await handleClose(interval, c.close);
        }
      } catch (err) {
        console.error(`[poll] ${interval} fetch failed`, err);
      }
    }
  };

  // Catch-up immediately for any candles already closed since key, then poll every 30s.
  await poll();
  timer = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
}

async function main() {
  const config = loadConfig();
  console.log(`[main] started symbol=${config.symbol} dryRun=${config.dryRun}`);

  if (config.dryRun) {
    await runOnce(config);
    return;
  }

  // 07:15 VN every day. node-cron supports timezone.
  cron.schedule('15 7 * * *', () => {
    console.log('[cron] 07:15 VN tick');
    void runOnce(config);
  }, { timezone: VN_TZ });

  console.log('[main] scheduler armed for 07:15 Asia/Ho_Chi_Minh');
}

main().catch((err) => {
  console.error('[main] fatal', err);
  process.exit(1);
});
