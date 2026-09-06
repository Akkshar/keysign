import { DigraphTiming } from '../types/biometrics';

export const mockDigraphTimings: DigraphTiming[] = [
  { digraph: 'T→H', dwellMs: 54, deltaPercent: 48, varianceText: '-18ms σ', type: 'secondary' },
  { digraph: 'E→R', dwellMs: 38, deltaPercent: 32, varianceText: '-24ms σ', type: 'secondary' },
  { digraph: 'I→N', dwellMs: 71, deltaPercent: 62, varianceText: '±2ms', type: 'primary' },
  { digraph: 'O→N', dwellMs: 59, deltaPercent: 50, varianceText: '-11ms σ', type: 'secondary' },
  { digraph: 'R→E', dwellMs: 46, deltaPercent: 40, varianceText: '-15ms σ', type: 'secondary' },
];

export const mockIdentityAuditEvents = [
  {
    timestamp: '14:32:10 UTC',
    context: 'Terminal (ssh / core-vault-01)',
    sampleBuffer: '128 keystrokes (RAM ephemeral)',
    matchScore: '99.7%',
    varianceVector: '±0.02σ (Normal)',
    status: 'AUTHORIZED',
  },
  {
    timestamp: '14:28:44 UTC',
    context: 'VS Code (crypto_engine.rs)',
    sampleBuffer: '512 keystrokes (RAM ephemeral)',
    matchScore: '99.2%',
    varianceVector: '±0.04σ (Normal)',
    status: 'AUTHORIZED',
  },
  {
    timestamp: '14:15:02 UTC',
    context: 'Slack (Engineering DM)',
    sampleBuffer: '256 keystrokes (RAM ephemeral)',
    matchScore: '98.5%',
    varianceVector: '±0.08σ (Casual Cadence)',
    status: 'AUTHORIZED',
  },
  {
    timestamp: '13:58:30 UTC',
    context: 'Terminal (git commit -S)',
    sampleBuffer: '64 keystrokes (RAM ephemeral)',
    matchScore: '99.8%',
    varianceVector: '±0.01σ (Hardware Match)',
    status: 'AUTHORIZED',
  },
];
