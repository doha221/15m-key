import { describe, it, expect } from 'vitest';
import { classifyBreak, BreakState, initState } from '../src/monitor.ts';

describe('classifyBreak', () => {
  const key = { high: 100, low: 90 };

  it('in-range close returns in_range, counter unchanged', () => {
    const state = initState();
    const result = classifyBreak(state, '3m', key, 95);
    expect(result.action).toBe('in_range');
    expect(result.state.count3m).toBe(0);
    expect(result.state.count5m).toBe(0);
  });

  it('close above high returns break_up and increments 3m counter', () => {
    const state = initState();
    const result = classifyBreak(state, '3m', key, 101);
    expect(result.action).toBe('break_up');
    expect(result.state.count3m).toBe(1);
  });

  it('close below low returns break_down and increments 5m counter', () => {
    const state = initState();
    const result = classifyBreak(state, '5m', key, 89);
    expect(result.action).toBe('break_down');
    expect(result.state.count5m).toBe(1);
  });

  it('counts independently and stops at 3 per timeframe', () => {
    let state: BreakState = initState();
    const closes3m: number[] = [101, 102, 89]; // 3 breaks (2 up, 1 down)
    for (const c of closes3m) state = classifyBreak(state, '3m', key, c).state;
    expect(state.count3m).toBe(3);
    expect(state.done3m).toBe(true);
    expect(state.done5m).toBe(false);

    // Further 3m events still classify but should not be relied on; consumer must check done3m first
    state = classifyBreak(state, '5m', key, 101).state;
    expect(state.count5m).toBe(1);
  });

  it('boundary values: close == high is in_range; close == low is in_range', () => {
    const state = initState();
    expect(classifyBreak(state, '3m', key, 100).action).toBe('in_range');
    expect(classifyBreak(state, '3m', key, 90).action).toBe('in_range');
  });
});
