// Physical Mechanical Typewriter Sound Synthesizer via Web Audio API
// Generates authentic metallic switch clicks, platen strikes, and carriage bell chimes

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const setSoundEnabled = (enabled: boolean) => {
  soundEnabled = enabled;
};

export const isSoundEnabled = (): boolean => soundEnabled;

/**
 * Synthesizes an authentic mechanical typewriter keypress:
 * Metallic hammer tick + low platen body thump + key release snap
 */
export const playMechanicalKeyClick = (char?: string) => {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Low mechanical chassis thump (damped sine wave)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  const baseFreq = 95 + Math.random() * 30;
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.045);

  oscGain.gain.setValueAtTime(0.35, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.05);

  // 2. High metallic impact click (bandpass filtered white noise)
  const bufferSize = ctx.sampleRate * 0.035; // 35ms
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2200 + Math.random() * 600, now);
  filter.Q.setValueAtTime(3.5, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.28, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  whiteNoise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  whiteNoise.start(now);

  // 3. Spacebar extra resonant wood/metal hollow thud
  if (char === ' ' || char === 'space') {
    const spaceOsc = ctx.createOscillator();
    const spaceGain = ctx.createGain();
    spaceOsc.type = 'sine';
    spaceOsc.frequency.setValueAtTime(75, now);
    spaceOsc.frequency.exponentialRampToValueAtTime(25, now + 0.07);
    spaceGain.gain.setValueAtTime(0.4, now);
    spaceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    spaceOsc.connect(spaceGain);
    spaceGain.connect(ctx.destination);
    spaceOsc.start(now);
    spaceOsc.stop(now + 0.075);
  }
};

/**
 * Synthesizes a vintage brass carriage return bell ('ding')
 */
export const playCarriageBell = () => {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Primary brass chime
  const bellOsc1 = ctx.createOscillator();
  const bellGain1 = ctx.createGain();
  bellOsc1.type = 'sine';
  bellOsc1.frequency.setValueAtTime(2480, now);

  bellGain1.gain.setValueAtTime(0.4, now);
  bellGain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

  bellOsc1.connect(bellGain1);
  bellGain1.connect(ctx.destination);
  bellOsc1.start(now);
  bellOsc1.stop(now + 0.9);

  // Secondary harmonic ring
  const bellOsc2 = ctx.createOscillator();
  const bellGain2 = ctx.createGain();
  bellOsc2.type = 'sine';
  bellOsc2.frequency.setValueAtTime(4960, now);

  bellGain2.gain.setValueAtTime(0.18, now);
  bellGain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

  bellOsc2.connect(bellGain2);
  bellGain2.connect(ctx.destination);
  bellOsc2.start(now);
  bellOsc2.stop(now + 0.5);
};
