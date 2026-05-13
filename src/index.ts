import cron from 'node-cron';
import { loadConfig } from './config.ts';
import { createTelegramClient } from './telegram.ts';
import { fetchKeyCandle, subscribeKlines, type Kline, type KlineSubscription } from './binance.ts';
import { initState, classifyBreak, allDone, type BreakState, type KeyRange, type Interval } from './monitor.ts';

const VN_TZ = 'Asia/Ho_Chi_Minh';

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
  const subs: Partial<Record<Interval, KlineSubscription>> = {};

  const handleClose = async (interval: Interval, close: number) => {
    if (interval === '3m' && state.done3m) return;
    if (interval === '5m' && state.done5m) return;

    const res = classifyBreak(state, interval, keyRange, close);
    state = res.state;
    if (res.action === 'in_range') return;

    const count = interval === '3m' ? state.count3m : state.count5m;
    await tg.send(formatBreakMessage(interval, res.action, close, keyRange, count));

    if (interval === '3m' && state.done3m) subs['3m']?.close();
    if (interval === '5m' && state.done5m) subs['5m']?.close();

    if (allDone(state)) {
      console.log('[main] both timeframes done; waiting for next day');
    }
  };

  subs['3m'] = subscribeKlines(config.symbol, '3m', (ev) => {
    void handleClose('3m', ev.close);
  });
  subs['5m'] = subscribeKlines(config.symbol, '5m', (ev) => {
    void handleClose('5m', ev.close);
  });
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
