export type DetectionArea =
  | 'introduction'
  | 'overview'
  | 'health-signals'
  | 'monitoring'
  | 'history'
  | 'privacy'
  | 'live-demo'
  | 'identity'
  | 'state'
  | 'threats'
  | 'drift'
  | 'settings';

export type StressPreset = 'baseline' | 'impersonator' | 'cognitive' | 'duress';

export interface KeystrokeTuple {
  id: string;
  timestamp: number;
  dwellMs: number;
  flightMs: number;
  entropy: number;
  status: 'VERIFIED' | 'CAUTION' | 'DURESS' | 'ANOMALOUS';
}

export interface VerificationEvent {
  id: string;
  timestamp: string;
  eventType: string;
  temporalSignature: string;
  confidenceScore: number;
  duressIndex: number;
  duressLabel: string;
  statusText: string;
  statusType: 'success' | 'warning' | 'info' | 'error';
}

export interface UserProfile {
  id: string;
  name: string;
  role: string;
  title: string;
  avatarUrl: string;
  enrolledSamples: number;
  modelVersion: string;
  entropyIntegrity: number;
  entropyStatus: string;
  meanDwell: number;
  dwellStdDev: number;
  meanFlight: number;
  flightStdDev: number;
  rhythmSynchrony: number;
  lastRecalibrated: string;
  currentConfidence: number;
}

export interface CognitiveStateData {
  cognitiveLoad: number;
  focusIndex: number;
  flowDurationMins: number;
  baselineVariance: number;
  varianceStdDev: number;
  burstinessIndex: number;
  pauseVariance: string;
  smartInterruptionActive: boolean;
}

export interface NeuromotorGauges {
  cadenceJitter: number;
  jitterSafeThreshold: number;
  panicBursting: number;
  burstSafeThreshold: number;
  flightVariance: number;
  flightAnomalyThreshold: number;
  dwellSaturation: number;
  dwellHoldLimit: number;
  threatLevel: 'Level 0 • Nominal' | 'Level 1 • Caution' | 'Level 2 • High' | 'Level 3 • Duress';
  threatStatus: 'ALL CLEAR' | 'ELEVATED' | 'DURESS DETECTED';
}

export interface DigraphTiming {
  digraph: string;
  dwellMs: number;
  deltaPercent: number;
  varianceText: string;
  type: 'primary' | 'secondary' | 'tertiary';
}
