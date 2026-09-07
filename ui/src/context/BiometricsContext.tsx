import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  DetectionArea,
  StressPreset,
  KeystrokeTuple,
  UserProfile,
  CognitiveStateData,
  NeuromotorGauges,
} from '../types/biometrics';
import {
  BaselineDoc,
  BaselineInfo,
  CaptureStream,
  FeedMessage,
  Tick,
  fetchBaseline,
  kpsToWpm,
  subscribeFeed,
  updateSettings,
} from '../lib/keysign';
import { WebcamSnap, postAlertPhoto, postFaceSample } from '../lib/webcam';

/**
 * Single source of truth for everything the views display.
 *
 * Connected to the local KeySign backend (ws://localhost:8000), every number
 * here is derived from the latest tick: the 28 live features, the person's
 * baseline distance, and the identity / state / threat heads. Keystrokes
 * typed anywhere in this window stream to that backend (timings only).
 *
 * Without a backend the original mock values and the judge presets remain,
 * so the UI still demos on its own.
 */

export interface LiveState {
  connected: boolean;          // tick feed from the backend
  streaming: boolean;          // this window's keystrokes are reaching the backend
  tick: Tick | null;
  users: BaselineInfo[];       // people with a baseline on disk
  declaredUser: string;        // whose baseline we measure against
  setDeclaredUser: (u: string) => void;
  reset: () => void;           // "someone new sits down": clear the backend window
  sessionId: string;
  photoOnIntruder: boolean;    // webcam frame taken (camera opened for one frame) on every alert; the backend decides what it means
  setPhotoOnIntruder: (on: boolean) => Promise<boolean>;
  cameraError: string | null;
  lastPhoto: string | null;    // file name of the most recent frame this session
  enrolFace: (user: string, frames?: number) => Promise<{ ok: boolean; n_samples: number; reason?: string }>;
}

interface BiometricsContextType {
  activeArea: DetectionArea;
  setActiveArea: (area: DetectionArea) => void;
  demoMode: boolean;
  setDemoMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  activePreset: StressPreset;
  setPreset: (preset: StressPreset) => void;
  userProfile: UserProfile;
  cognitiveState: CognitiveStateData;
  setCognitiveState: React.Dispatch<React.SetStateAction<CognitiveStateData>>;
  neuromotorGauges: NeuromotorGauges;
  eventsPerSec: number;
  liveConfidence: number;
  liveWpm: number;
  liveDwell: number;
  liveFlight: number;
  liveJitter: number;
  recentPulses: KeystrokeTuple[];
  terminalLogs: string[];
  clearTerminal: () => void;
  alertCardOpen: boolean;
  setAlertCardOpen: (open: boolean) => void;
  onKeyAction: (action: 'down' | 'up', e?: KeyboardEvent) => void;
  isTyping: boolean;
  live: LiveState;
  stateTimeline: StateTimelineEvent[];
}

export interface StateTimelineEvent { num: number; time: string; title: string; color: string; textColor: string; desc: string }

const USER_KEY = 'keysign.ui.user';
const PHOTO_KEY = 'keysign.ui.photoOnIntruder';

const defaultProfile: UserProfile = {
  id: 'demo',
  name: 'No one enrolled',
  role: 'Waiting for the backend',
  title: 'Start the backend (uv run python -m backend) and record 10+ calm samples on the capture page',
  avatarUrl: '',
  enrolledSamples: 0,
  modelVersion: 'RandomForest on 22 timing features · on-device',
  entropyIntegrity: 0,
  entropyStatus: 'No baseline',
  meanDwell: 0,
  dwellStdDev: 0,
  meanFlight: 0,
  flightStdDev: 0,
  rhythmSynchrony: 0,
  lastRecalibrated: 'never',
  currentConfidence: 0,
};

const defaultCognitive: CognitiveStateData = {
  cognitiveLoad: 42,
  focusIndex: 78,
  flowDurationMins: 0,
  baselineVariance: 1.0,
  varianceStdDev: 0.0,
  burstinessIndex: 1.0,
  pauseVariance: 'Low Deviation',
  smartInterruptionActive: true,
};

const defaultGauges: NeuromotorGauges = {
  cadenceJitter: 0.08,
  jitterSafeThreshold: 0.35,
  panicBursting: 0.02,
  burstSafeThreshold: 0.40,
  flightVariance: 12,
  flightAnomalyThreshold: 65,
  dwellSaturation: 84,
  dwellHoldLimit: 220,
  threatLevel: 'Level 0 • Nominal',
  threatStatus: 'ALL CLEAR',
};

const initialPulses: KeystrokeTuple[] = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1),
  timestamp: Date.now() - (20 - i) * 100,
  dwellMs: 80 + ((i * 7) % 10),
  flightMs: 108 + ((i * 11) % 18),
  entropy: 0.97,
  status: 'VERIFIED' as const,
}));

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Map one backend tick onto the view model the components already render. */
function deriveFromTick(tick: Tick, declared: string, baselineDoc: BaselineDoc | null, users: BaselineInfo[]) {
  const f = tick.features || {};
  const z = tick.z || {};
  const idn = tick.heads?.identity;
  const st = tick.heads?.state;
  const th = tick.heads?.threat;
  const d = tick.distance ?? null;
  const conf = idn && idn.user && typeof idn.confidence === 'number' ? idn.confidence * 100 : null;
  const confidence = conf ?? (d == null ? 0 : clamp(100 - d * 20, 0, 100));
  const level = th?.level ?? 'none';
  const load = st?.load ?? null;

  const preset: StressPreset =
    level === 'alert' ? (th?.kind === 'intruder' ? 'impersonator' : 'duress')
    : st?.label === 'high load' ? 'cognitive'
    : 'baseline';

  const name = idn?.user || declared || tick.user;
  const info = users.find((u) => u.user === (declared || tick.user));
  const centerOf = (key: string) => (baselineDoc ? baselineDoc.center[baselineDoc.features.indexOf(key)] : undefined);
  const scaleOf = (key: string) => (baselineDoc ? baselineDoc.scale[baselineDoc.features.indexOf(key)] : undefined);
  const sync = d == null ? 0 : clamp(100 - d * 20, 0, 100);

  const profile: UserProfile = {
    id: slug(name || 'unknown'),
    name: idn?.unknown ? 'UNKNOWN USER' : name,
    role: idn?.warming_up ? 'Identifying · keep typing'
      : idn?.unknown ? `Does not match anyone enrolled (closest: ${idn?.closest || idn?.user})`
      : idn && idn.matches_declared === false ? `Typing under ${declared || tick.user}'s name`
      : 'Enrolled · baseline on this device',
    title: d == null ? 'No baseline for the declared user yet'
      : `${d.toFixed(2)}σ from ${tick.baseline?.user}'s calm baseline · identity ${confidence.toFixed(0)}%`,
    avatarUrl: '',
    enrolledSamples: tick.baseline?.n_samples ?? 0,
    modelVersion: 'RandomForest · 22 timing features · on-device',
    entropyIntegrity: Math.round(sync * 10) / 10,
    entropyStatus: d == null ? 'No baseline' : d < 1.5 ? 'Typical' : d < 2.5 ? 'Drifting' : 'Anomalous',
    meanDwell: Math.round((centerOf('hold_mean') ?? f.hold_mean ?? 0) * 10) / 10,
    dwellStdDev: Math.round((scaleOf('hold_mean') ?? 0) * 10) / 10,
    meanFlight: Math.round((centerOf('flight_mean') ?? f.flight_mean ?? 0) * 10) / 10,
    flightStdDev: Math.round((scaleOf('flight_mean') ?? 0) * 10) / 10,
    rhythmSynchrony: Math.round(sync * 10) / 10,
    lastRecalibrated: info?.created_at ? new Date(info.created_at).toLocaleString() : 'unknown',
    currentConfidence: Math.round(confidence * 10) / 10,
  };

  const cognitive: CognitiveStateData = {
    cognitiveLoad: load == null ? 0 : Math.round(load * 100),
    focusIndex: load == null ? 0 : Math.round(100 - load * 100),
    flowDurationMins: 0,
    baselineVariance: d == null ? 0 : Math.round(d * 100) / 100,
    varianceStdDev: Math.round((f.rhythm_cv ?? 0) * 100) / 100,
    burstinessIndex: Math.round((1 + (f.rp_negative_ratio ?? 0) * 2) * 100) / 100,
    pauseVariance: (f.pause_ratio ?? 0) > 0.1 ? 'Elevated Pause Clusters' : 'Low Deviation',
    smartInterruptionActive: st?.advice === 'defer',
  };

  const gauges: NeuromotorGauges = {
    cadenceJitter: Math.round(clamp(Math.abs(z.rhythm_cv ?? 0) * 0.1) * 100) / 100,
    jitterSafeThreshold: 0.35,
    panicBursting: Math.round(clamp((f.error_rate ?? 0) * 2) * 100) / 100,
    burstSafeThreshold: 0.40,
    flightVariance: Math.round(clamp(Math.abs(z.flight_std ?? 0) * 15, 0, 100)),
    flightAnomalyThreshold: 65,
    dwellSaturation: Math.round(f.hold_mean ?? 0),
    dwellHoldLimit: 220,
    threatLevel: level === 'alert' ? 'Level 3 • Duress' : level === 'warn' ? 'Level 1 • Caution' : 'Level 0 • Nominal',
    threatStatus: level === 'alert' ? 'DURESS DETECTED' : level === 'warn' ? 'ELEVATED' : 'ALL CLEAR',
  };

  return {
    preset, profile, cognitive, gauges,
    confidence: Math.round(confidence * 10) / 10,
    wpm: kpsToWpm(f.speed_kps ?? 0),
    dwell: Math.round(f.hold_mean ?? 0),
    flight: Math.round(f.flight_mean ?? 0),
    jitter: Math.round((f.rhythm_cv ?? 0) * 100) / 100,
    eventsPerSec: Math.round((tick.n_events || 0) / (tick.window_s || 10)),
    logLine: JSON.stringify({
      t: new Date(tick.ts * 1000).toLocaleTimeString(),
      keys: tick.n_keys,
      declared: tick.user,
      identity: idn?.user ?? null,
      conf: conf == null ? null : Math.round(conf),
      distance: d == null ? null : Math.round(d * 100) / 100,
      load: load == null ? null : Math.round(load * 100) / 100,
      threat: level,
      kind: th?.kind ?? null,
    }),
    alertsTotal: th?.alerts_total ?? 0,
  };
}

const BiometricsContext = createContext<BiometricsContextType | undefined>(undefined);

export const BiometricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeArea, setActiveArea] = useState<DetectionArea>('monitoring');   // land on the live lab, not the roadmap
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<StressPreset>('baseline');
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultProfile);
  const [cognitiveState, setCognitiveState] = useState<CognitiveStateData>(defaultCognitive);
  const [neuromotorGauges, setNeuromotorGauges] = useState<NeuromotorGauges>(defaultGauges);
  const [alertCardOpen, setAlertCardOpen] = useState<boolean>(false);

  const [eventsPerSec, setEventsPerSec] = useState<number>(0);
  const [liveConfidence, setLiveConfidence] = useState<number>(0);
  const [liveWpm, setLiveWpm] = useState<number>(0);
  const [liveDwell, setLiveDwell] = useState<number>(84);
  const [liveFlight, setLiveFlight] = useState<number>(112);
  const [liveJitter, setLiveJitter] = useState<number>(0.04);
  const [recentPulses, setRecentPulses] = useState<KeystrokeTuple[]>(initialPulses);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '{"info":"waiting for the local KeySign backend on ws://localhost:8000"}',
  ]);

  // ---- live backend ----
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [tick, setTick] = useState<Tick | null>(null);
  const [stateTimeline, setStateTimeline] = useState<StateTimelineEvent[]>([]);
  const lastLabel = useRef<string | null>(null);
  const [users, setUsers] = useState<BaselineInfo[]>([]);
  const [declaredUser, setDeclaredUserState] = useState<string>(() => {
    try { return localStorage.getItem(USER_KEY) || ''; } catch { return ''; }
  });
  const [baselineDoc, setBaselineDoc] = useState<BaselineDoc | null>(null);
  const captureRef = useRef<CaptureStream | null>(null);
  const declaredRef = useRef(declaredUser);
  const lastAlertTs = useRef<number | null>(null);   // the backend's per-session counter resets on Reset; the timestamp doesn't
  // ---- webcam frame on intruder alerts (opt-in, Settings) ----
  const camRef = useRef<WebcamSnap | null>(null);
  const [photoOnIntruder, setPhotoOnIntruderState] = useState<boolean>(() => {
    try { return localStorage.getItem(PHOTO_KEY) === '1'; } catch { return false; }
  });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const photoRef = useRef(photoOnIntruder);
  useEffect(() => { photoRef.current = photoOnIntruder; }, [photoOnIntruder]);
  const usersRef = useRef<BaselineInfo[]>([]);
  const baselineRef = useRef<BaselineDoc | null>(null);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { baselineRef.current = baselineDoc; }, [baselineDoc]);

  // subscribe to ticks
  useEffect(() => {
    const stop = subscribeFeed((m: FeedMessage) => {
      if (m.type === 'hello') {
        setUsers(m.baselines || []);
        if (!declaredRef.current && m.baselines?.length) setDeclaredUser(m.baselines[0].user);
        return;
      }
      if (m.type !== 'tick') return;
      setTick(m);
      if (!m.features) return;
      const dv = deriveFromTick(m, declaredRef.current, baselineRef.current, usersRef.current);
      const label = m.heads?.state?.label;
      if (label && label !== lastLabel.current) {
        lastLabel.current = label;
        const styles: Record<string, [string, string]> = {
          'deep focus': ['bg-primary text-on-primary', 'text-primary'],
          'engaged': ['bg-secondary text-on-secondary', 'text-secondary'],
          'high load': ['bg-tertiary text-on-tertiary', 'text-tertiary'],
        };
        const [color, textColor] = styles[label] || styles['engaged'];
        const drivers = (m.heads?.state?.drivers || []).slice(0, 2).map(([f, v]) => `${f} ${v > 0 ? '+' : ''}${v.toFixed(1)}`).join(', ');
        setStateTimeline((prev) => [...prev.slice(-11), {
          num: prev.length + 1,
          time: new Date(m.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          title: label.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          color, textColor,
          desc: `${m.user}: load ${Math.round((m.heads?.state?.load ?? 0) * 100)}/100${drivers ? ' · ' + drivers : ''} · ${m.heads?.state?.advice === 'defer' ? 'defer notifications' : 'ok to interrupt'}`,
        }]);
      }
      setActivePreset(dv.preset);
      setUserProfile(dv.profile);
      setCognitiveState((prev) => ({ ...dv.cognitive, flowDurationMins: prev.flowDurationMins }));
      setNeuromotorGauges(dv.gauges);
      setLiveConfidence(dv.confidence);
      setLiveWpm(dv.wpm);
      setLiveDwell(dv.dwell);
      setLiveFlight(dv.flight);
      setLiveJitter(dv.jitter);
      setEventsPerSec(dv.eventsPerSec);
      setTerminalLogs((prev) => [...prev.slice(-15), dv.logLine]);
      const th = m.heads?.threat;
      const alertTs = th?.last_alert?.ts ?? null;
      if (alertTs != null && alertTs !== lastAlertTs.current) {
        lastAlertTs.current = alertTs;
        setAlertCardOpen(true);
        if (photoRef.current) {                       // both kinds: the camera decides intruder / duress / kept local
          const ts = alertTs;
          const cam = camRef.current ?? (camRef.current = new WebcamSnap());
          cam.snap().then((blob) => blob && postAlertPhoto(ts, m.session, blob))
            .then((r) => { if (r && r.ok && r.photo) setLastPhoto(r.photo); })
            .catch(() => {});
        }
      }
    }, setConnected);
    return stop;
  }, []);

  // stream this window's keystrokes to the backend while connected
  useEffect(() => {
    if (!connected) { captureRef.current?.stop(); captureRef.current = null; setStreaming(false); return; }
    const cs = new CaptureStream(declaredRef.current);
    cs.onStatus = setStreaming;
    cs.start();
    captureRef.current = cs;
    return () => { cs.stop(); captureRef.current = null; setStreaming(false); };
  }, [connected]);

  const setDeclaredUser = useCallback((u: string) => {
    declaredRef.current = u;
    setDeclaredUserState(u);
    try { localStorage.setItem(USER_KEY, u); } catch { /* ignore */ }
    captureRef.current?.setUser(u);
    fetchBaseline(u).then(setBaselineDoc).catch(() => setBaselineDoc(null));
    void updateSettings({ declared_user: u });            // the desktop agent measures against the same person
  }, []);

  useEffect(() => {
    if (declaredUser) fetchBaseline(declaredUser).then(setBaselineDoc).catch(() => setBaselineDoc(null));
  }, [declaredUser, connected]);

  const reset = useCallback(() => {
    captureRef.current?.reset();
    setTick(null);
  }, []);

  // Switching on asks for the camera once (so the permission is granted before it matters),
  // then closes it again. From then on the camera opens only for the one frame of an alert.
  const setPhotoOnIntruder = useCallback(async (on: boolean) => {
    if (!on) {
      camRef.current?.disable(); camRef.current = null;
      setPhotoOnIntruderState(false); setCameraError(null);
      try { localStorage.setItem(PHOTO_KEY, '0'); } catch { /* ignore */ }
      return false;
    }
    const cam = new WebcamSnap();
    const ok = await cam.enable();
    cam.disable();
    camRef.current = ok ? cam : null;
    setCameraError(ok ? null : cam.error);
    setPhotoOnIntruderState(ok);
    try { localStorage.setItem(PHOTO_KEY, ok ? '1' : '0'); } catch { /* ignore */ }
    return ok;
  }, []);

  useEffect(() => () => { camRef.current?.disable(); }, []);

  // Owner face enrolment: a few frames over ~2 s, cropped and stored by the backend.
  const enrolFace = useCallback(async (user: string, frames = 5) => {
    const cam = new WebcamSnap();
    if (!(await cam.enable())) { setCameraError(cam.error); return { ok: false, n_samples: 0, reason: cam.error || 'camera unavailable' }; }
    let last: { ok: boolean; n_samples?: number; reason?: string } = { ok: false };
    try {
      await new Promise((r) => setTimeout(r, 400));
      for (let i = 0; i < frames; i++) {
        const blob = await cam.capture();
        if (blob) last = await postFaceSample(user, blob);
        await new Promise((r) => setTimeout(r, 350));
      }
    } finally { cam.disable(); }
    return { ok: !!last.ok, n_samples: last.n_samples ?? 0, reason: last.reason };
  }, []);

  // minutes in the current focus stretch (counted while the state head says deep focus / engaged)
  useEffect(() => {
    const id = setInterval(() => {
      setCognitiveState((prev) => ({
        ...prev,
        flowDurationMins: prev.cognitiveLoad < 50 && connected ? Math.round((prev.flowDurationMins + 1 / 60) * 100) / 100 : 0,
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [connected]);

  // ---- judge presets: only meaningful without a backend (a tick overrides them) ----
  const setPreset = useCallback((preset: StressPreset) => {
    setActivePreset(preset);
    if (connected) return;
    if (preset === 'baseline') {
      setLiveConfidence(99.4); setLiveWpm(74); setLiveDwell(84); setLiveFlight(112); setLiveJitter(0.04);
      setNeuromotorGauges(defaultGauges); setCognitiveState(defaultCognitive);
    } else if (preset === 'impersonator') {
      setLiveConfidence(32.8); setLiveWpm(52); setLiveDwell(148); setLiveFlight(242); setLiveJitter(0.38);
      setNeuromotorGauges((prev) => ({ ...prev, cadenceJitter: 0.38, flightVariance: 74, dwellSaturation: 148, threatLevel: 'Level 2 • High', threatStatus: 'ELEVATED' }));
    } else if (preset === 'cognitive') {
      setLiveConfidence(88.6); setLiveWpm(61); setLiveDwell(102); setLiveFlight(168); setLiveJitter(0.18);
      setCognitiveState({ cognitiveLoad: 89, focusIndex: 44, flowDurationMins: 12, baselineVariance: 8.2, varianceStdDev: 2.15, burstinessIndex: 2.45, pauseVariance: 'Elevated Pause Clusters', smartInterruptionActive: true });
    } else if (preset === 'duress') {
      setLiveConfidence(41.2); setLiveWpm(89); setLiveDwell(62); setLiveFlight(88); setLiveJitter(0.82);
      setNeuromotorGauges({ ...defaultGauges, cadenceJitter: 0.82, panicBursting: 0.76, flightVariance: 92, dwellSaturation: 188, threatLevel: 'Level 3 • Duress', threatStatus: 'DURESS DETECTED' });
    }
  }, [connected]);

  // ---- local per-keystroke timing (feeds the waterfall + typewriter; the backend does the real analysis) ----
  const lastDownTime = useRef<number>(0);
  const lastUpTime = useRef<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqCounter = useRef<number>(0);
  const presetRef = useRef(activePreset);
  useEffect(() => { presetRef.current = activePreset; }, [activePreset]);
  const flightRef = useRef(112);

  const onKeyAction = useCallback((action: 'down' | 'up', e?: KeyboardEvent) => {
    if (e) captureRef.current?.push(e, action);          // real timings -> backend (once per event)
    setIsTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), 1200);

    const now = performance.now();
    if (action === 'down') {
      const flight = lastUpTime.current > 0 ? Math.round(now - lastUpTime.current) : 112;
      lastDownTime.current = now;
      if (flight > 10 && flight < 1000) flightRef.current = flight;
    } else {
      const dwell = lastDownTime.current > 0 ? Math.round(now - lastDownTime.current) : 84;
      lastUpTime.current = now;
      if (!(dwell > 15 && dwell < 500)) return;
      seqCounter.current += 1;
      const preset = presetRef.current;
      const pulse: KeystrokeTuple = {
        id: String(seqCounter.current),
        timestamp: Date.now(),
        dwellMs: dwell,
        flightMs: flightRef.current,
        entropy: 0.97,
        status: preset === 'duress' ? 'DURESS' : preset === 'impersonator' ? 'ANOMALOUS' : preset === 'cognitive' ? 'CAUTION' : 'VERIFIED',
      };
      setRecentPulses((prev) => [...prev.slice(1), pulse]);
    }
  }, []);

  const clearTerminal = () => setTerminalLogs([]);

  const live = useMemo<LiveState>(() => ({
    connected, streaming, tick, users, declaredUser, setDeclaredUser, reset,
    sessionId: captureRef.current?.session ?? '',
    photoOnIntruder, setPhotoOnIntruder, cameraError, lastPhoto, enrolFace,
  }), [connected, streaming, tick, users, declaredUser, setDeclaredUser, reset, photoOnIntruder, setPhotoOnIntruder, cameraError, lastPhoto, enrolFace]);

  return (
    <BiometricsContext.Provider
      value={{
        activeArea, setActiveArea, demoMode, setDemoMode, activePreset, setPreset,
        userProfile, cognitiveState, setCognitiveState, neuromotorGauges, eventsPerSec,
        liveConfidence, liveWpm, liveDwell, liveFlight, liveJitter, recentPulses,
        terminalLogs, clearTerminal, alertCardOpen, setAlertCardOpen, onKeyAction, isTyping, live, stateTimeline,
      }}
    >
      {children}
    </BiometricsContext.Provider>
  );
};

export const useBiometrics = () => {
  const context = useContext(BiometricsContext);
  if (!context) {
    throw new Error('useBiometrics must be used within a BiometricsProvider');
  }
  return context;
};
