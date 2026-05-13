import WebSocket from 'ws';

const FUTURES_REST = 'https://fapi.binance.com';
const FUTURES_WS = 'wss://fstream.binance.com/ws';

export interface Kline {
  openTime: number; // ms UTC
  open: number;
  high: number;
  low: number;
  close: number;
}

export async function fetchKeyCandle(symbol: string, openTimeUtcMs: number): Promise<Kline> {
  const url = `${FUTURES_REST}/fapi/v1/klines?symbol=${symbol}&interval=15m&startTime=${openTimeUtcMs}&limit=1`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`binance ${res.status}: ${await res.text()}`);
      const arr = (await res.json()) as unknown[][];
      if (arr.length === 0) throw new Error('empty klines response');
      const row = arr[0]!;
      const openTime = Number(row[0]);
      if (openTime !== openTimeUtcMs) {
        throw new Error(`unexpected openTime ${openTime}, want ${openTimeUtcMs}`);
      }
      return {
        openTime,
        open: parseFloat(row[1] as string),
        high: parseFloat(row[2] as string),
        low: parseFloat(row[3] as string),
        close: parseFloat(row[4] as string),
      };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetchKeyCandle failed');
}

export interface ClosedKline {
  openTime: number;
  closeTime: number;
  close: number;
}

export async function fetchClosedKlines(
  symbol: string,
  interval: '3m' | '5m',
  startTimeMs: number,
  endTimeMs: number,
): Promise<ClosedKline[]> {
  const url = `${FUTURES_REST}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${startTimeMs}&endTime=${endTimeMs}&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`binance ${res.status}: ${await res.text()}`);
  const arr = (await res.json()) as unknown[][];
  const nowMs = Date.now();
  return arr
    .map((row) => ({
      openTime: Number(row[0]),
      closeTime: Number(row[6]),
      close: parseFloat(row[4] as string),
    }))
    .filter((k) => k.closeTime < nowMs);
}

export interface KlineCloseEvent {
  interval: '3m' | '5m';
  close: number;
  closeTimeMs: number;
}

export interface KlineSubscription {
  close(): void;
}

export function subscribeKlines(
  symbol: string,
  interval: '3m' | '5m',
  onClose: (ev: KlineCloseEvent) => void,
): KlineSubscription {
  const stream = `${symbol.toLowerCase()}@kline_${interval}`;
  let ws: WebSocket | null = null;
  let closed = false;
  let backoff = 1000;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(`${FUTURES_WS}/${stream}`);

    ws.on('open', () => {
      backoff = 1000;
      console.log(`[ws] connected ${stream}`);
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { k?: { x: boolean; c: string; T: number } };
        if (msg.k?.x === true) {
          onClose({ interval, close: parseFloat(msg.k.c), closeTimeMs: msg.k.T });
        }
      } catch (err) {
        console.error('[ws] parse error', err);
      }
    });

    const reconnect = (reason: string) => {
      if (closed) return;
      console.warn(`[ws] ${stream} ${reason}; reconnect in ${backoff}ms`);
      setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30000);
    };

    ws.on('close', () => reconnect('closed'));
    ws.on('error', (err) => {
      console.error(`[ws] ${stream} error`, err);
      ws?.close();
    });
  };

  connect();

  return {
    close() {
      closed = true;
      ws?.close();
    },
  };
}
