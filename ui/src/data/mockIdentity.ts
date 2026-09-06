import { DigraphTiming } from '../types/biometrics';

/**
 * Illustrative only. The live identity model uses aggregate timing features,
 * not per-digraph latencies; this list exists to show what a digraph is.
 * Nothing here is measured, so nothing here carries a precision.
 */
export const mockDigraphTimings: DigraphTiming[] = [
  { digraph: 'T→H', dwellMs: 54, deltaPercent: 48, varianceText: 'common, fast', type: 'primary' },
  { digraph: 'E→R', dwellMs: 38, deltaPercent: 32, varianceText: 'common, fast', type: 'primary' },
  { digraph: 'I→N', dwellMs: 71, deltaPercent: 62, varianceText: 'common', type: 'primary' },
  { digraph: 'O→N', dwellMs: 59, deltaPercent: 50, varianceText: 'common', type: 'primary' },
  { digraph: 'R→E', dwellMs: 46, deltaPercent: 40, varianceText: 'common, fast', type: 'primary' },
];
