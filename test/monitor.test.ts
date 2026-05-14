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

  it('one break per timeframe sets done; counts independently', () => {
    let state: BreakState = initState();
    state = classifyBreak(state, '3m', key, 101).state;
    expect(state.count3m).toBe(1);
    expect(state.done3m).toBe(true);
    expect(state.done5m).toBe(false);

    state = classifyBreak(state, '5m', key, 89).state;
    expect(state.count5m).toBe(1);
    expect(state.done5m).toBe(true);
  });

  it('boundary values: close == high is in_range; close == low is in_range', () => {
    const state = initState();
    expect(classifyBreak(state, '3m', key, 100).action).toBe('in_range');
    expect(classifyBreak(state, '3m', key, 90).action).toBe('in_range');
  });
});
