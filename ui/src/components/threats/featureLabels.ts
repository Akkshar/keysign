/** Plain-English names for the pipeline's feature keys (pipeline/features.py FEATURE_NAMES). */
const LABELS: Record<string, string> = {
  n_keys: 'Keys in window',
  duration_s: 'Window length',
  hold_mean: 'Hold time',
  hold_std: 'Hold variance',
  hold_median: 'Hold time (median)',
  flight_mean: 'Flight time',
  flight_std: 'Flight variance',
  flight_median: 'Flight time (median)',
  rp_mean: 'Release-to-press gap',
  rp_std: 'Release-to-press variance',
  rp_negative_ratio: 'Key overlap',
  speed_kps: 'Typing speed',
  error_rate: 'Error rate',
  rhythm_cv: 'Rhythm variance',
  pause_count: 'Pauses',
  pause_ratio: 'Time paused',
  longest_pause_ms: 'Longest pause',
  modifier_ratio: 'Modifier use',
};

export const featureLabel = (key: string): string =>
  LABELS[key] ?? (key.startsWith('dg_') ? `Digraph "${key.slice(3)}"` : key.replace(/_/g, ' '));
