export type Interval = '3m' | '5m';
export type Action = 'in_range' | 'break_up' | 'break_down';

export interface KeyRange {
  high: number;
  low: number;
}

export interface BreakState {
  count3m: number;
  count5m: number;
  done3m: boolean;
  done5m: boolean;
}

export interface ClassifyResult {
  action: Action;
  state: BreakState;
}

const MAX_BREAKS = 1;

export function initState(): BreakState {
  return { count3m: 0, count5m: 0, done3m: false, done5m: false };
}

export function classifyBreak(
  state: BreakState,
  interval: Interval,
  key: KeyRange,
  close: number,
): ClassifyResult {
  let action: Action = 'in_range';
  if (close > key.high) action = 'break_up';
  else if (close < key.low) action = 'break_down';

  if (action === 'in_range') return { action, state };

  const next: BreakState = { ...state };
  if (interval === '3m') {
    next.count3m += 1;
    if (next.count3m >= MAX_BREAKS) next.done3m = true;
  } else {
    next.count5m += 1;
    if (next.count5m >= MAX_BREAKS) next.done5m = true;
  }
  return { action, state: next };
}

export function allDone(state: BreakState): boolean {
  return state.done3m && state.done5m;
}
