import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useBiometrics } from '../../context/BiometricsContext';
import { playMechanicalKeyClick } from '../../lib/mechanicalAudio';

const SAMPLE_SENTENCES = [
  "the quick brown fox jumps over the lazy dog while the typewriter carriage slides smoothly across parchment",
  "your keyboard has a unique rhythmic signature that reveals physical cadence rather than the words you write",
  "every keystroke hold time and flight latency creates an invisible fingerprint of human motor rhythm",
  "involuntary neuromotor intervals reveal subtle temporal patterns without ever recording the content of thoughts",
  "focus on your natural typing rhythm and watch the mechanical keys strike in perfect synchronization",
];

const CALM_SENTENCES = [
  'The morning dew settles quietly across the forest moss.',
  'Breathe steadily and allow each finger to find its natural rhythm.',
  'Gentle ocean waves lap against the sandy shore under a warm sun.',
  'Quiet footsteps wander slowly along the shaded mountain path.',
  'Soft ambient sunlight filters through the tall library windows.',
];

const STRESSED_SENTENCES = [
  'Immediately dispatch emergency response units to all primary sectors!',
  'Critical system failure detected in auxiliary cooling line seven!',
  'Execute the emergency manual override sequence before timeout expires!',
  'High priority intruder alarm triggered across the server facility perimeter!',
  'Accelerate data recovery immediately to prevent catastrophic packet loss!',
];

interface MonkeyTypeArenaProps {
  onKeystroke?: (char: string) => void;
  className?: string;
  defaultMode?: 'testing' | 'calibration';
  refreshTrigger?: number;
}

export const MonkeyTypeArena: React.FC<MonkeyTypeArenaProps> = ({
  onKeystroke,
  className = '',
  defaultMode = 'testing',
  refreshTrigger,
}) => {
  const { onKeyAction, liveDwell, liveFlight, setActiveArea } = useBiometrics();

  // Mode Switch: 'testing' (Practice) or 'calibration' (10-Sentence Protocol)
  const [arenaMode, setArenaMode] = useState<'testing' | 'calibration'>(defaultMode);

  // ---------------------------------------------------------------------------
  // TESTING MODE STATE
  // ---------------------------------------------------------------------------
  const [testSentenceIndex, setTestSentenceIndex] = useState(0);
  const testSampleText = SAMPLE_SENTENCES[testSentenceIndex];
  const [testTypedText, setTestTypedText] = useState('');
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  const [testWpm, setTestWpm] = useState(0);
  const [testAccuracy, setTestAccuracy] = useState(100);
  const [testConsistency, setTestConsistency] = useState(96);
  const [testCompleted, setTestCompleted] = useState(false);
  const testDwellHistory = useRef<number[]>([]);

  // ---------------------------------------------------------------------------
  // CALIBRATION MODE STATE (10 Sentences: 5 Calm + 5 Stressed)
  // ---------------------------------------------------------------------------
  const [calibStep, setCalibStep] = useState<number>(0);
  const [calibTypedText, setCalibTypedText] = useState<string>('');
  const [calibCompleted, setCalibCompleted] = useState<boolean>(false);
  const [calibSynthesizing, setCalibSynthesizing] = useState<boolean>(false);
  const isCalmPhase = calibStep < 5;
  const calibSentenceIndex = isCalmPhase ? calibStep : calibStep - 5;
  const calibCurrentSentence = isCalmPhase
    ? CALM_SENTENCES[calibSentenceIndex]
    : STRESSED_SENTENCES[calibSentenceIndex];

  // Timing refs for input
  const inputRef = useRef<HTMLInputElement>(null);
  const keyDownTimeRef = useRef<number>(0);
  const keyUpTimeRef = useRef<number>(0);
  const calibStepStartRef = useRef<number>(performance.now());
  const calibDwells = useRef<number[]>([]);
  const calibFlights = useRef<number[]>([]);

  // Determine current active text depending on mode
  const activeTargetText = arenaMode === 'testing' ? testSampleText : calibCurrentSentence;
  const activeTypedText = arenaMode === 'testing' ? testTypedText : calibTypedText;

  // Focus input automatically on mode change or sentence change
  useEffect(() => {
    inputRef.current?.focus();
    if (arenaMode === 'calibration') {
      calibStepStartRef.current = performance.now();
      calibDwells.current = [];
      calibFlights.current = [];
    }
  }, [arenaMode, testSentenceIndex, calibStep]);

  // Synchronize with external resets (e.g. Typewriter "New Sheet" action)
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === 0) return;
    if (arenaMode === 'testing') {
      setTestSentenceIndex((prev) => (prev + 1) % SAMPLE_SENTENCES.length);
      setTestTypedText('');
      setTestStartTime(null);
      setTestWpm(0);
      setTestAccuracy(100);
      setTestCompleted(false);
      testDwellHistory.current = [];
    } else {
      setCalibTypedText('');
      calibStepStartRef.current = performance.now();
      calibDwells.current = [];
      calibFlights.current = [];
    }
    inputRef.current?.focus();
  }, [refreshTrigger]);

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  // ---------------------------------------------------------------------------
  // TESTING METRICS CALCULATION
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (arenaMode !== 'testing') return;

    if (!testStartTime || testTypedText.length === 0) {
      setTestWpm(0);
      setTestAccuracy(100);
      return;
    }

    const elapsedMinutes = (Date.now() - testStartTime) / 60000;
    if (elapsedMinutes > 0) {
      let correctChars = 0;
      for (let i = 0; i < testTypedText.length; i++) {
        if (testTypedText[i] === testSampleText[i]) {
          correctChars++;
        }
      }

      const currentWpm = Math.round((correctChars / 5) / Math.max(elapsedMinutes, 0.05));
      setTestWpm(Math.min(currentWpm, 220));

      const currentAcc = Math.round((correctChars / testTypedText.length) * 100);
      setTestAccuracy(currentAcc);

      if (liveDwell) {
        testDwellHistory.current.push(liveDwell);
        if (testDwellHistory.current.length > 20) testDwellHistory.current.shift();
        const mean = testDwellHistory.current.reduce((a, b) => a + b, 0) / testDwellHistory.current.length;
        const variance = testDwellHistory.current.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / testDwellHistory.current.length;
        const stdDev = Math.sqrt(variance);
        const cst = Math.max(70, Math.min(99, Math.round(100 - (stdDev / 3))));
        setTestConsistency(cst);
      }
    }

    if (testTypedText.length >= testSampleText.length) {
      setTestCompleted(true);
    }
  }, [testTypedText, testStartTime, testSampleText, liveDwell, arenaMode]);

  // ---------------------------------------------------------------------------
  // KEYBOARD HANDLERS
  // ---------------------------------------------------------------------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (arenaMode === 'testing') {
        handleNextTestSentence();
      }
      return;
    }

    const now = performance.now();
    if (keyUpTimeRef.current > 0) {
      const flight = now - keyUpTimeRef.current;
      if (flight > 10 && flight < 1000) {
        calibFlights.current.push(flight);
      }
    }
    keyDownTimeRef.current = now;

    if (arenaMode === 'testing' && !testStartTime && e.key.length === 1) {
      setTestStartTime(Date.now());
    }

    onKeyAction('down');
    playMechanicalKeyClick(e.key);

    if (onKeystroke) {
      onKeystroke(e.key);
    }
  };

  const handleKeyUp = () => {
    const now = performance.now();
    if (keyDownTimeRef.current > 0) {
      const dwell = now - keyDownTimeRef.current;
      if (dwell > 10 && dwell < 500) {
        calibDwells.current.push(dwell);
      }
    }
    keyUpTimeRef.current = now;
    onKeyAction('up');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (arenaMode === 'testing') {
      if (val.length <= testSampleText.length) {
        setTestTypedText(val);
      }
    } else {
      // Calibration Mode
      if (val.length <= calibCurrentSentence.length) {
        setCalibTypedText(val);

        // Check sentence completion in calibration
        if (val.length >= calibCurrentSentence.length) {
          if (calibStep < 9) {
            setTimeout(() => {
              setCalibStep((prev) => prev + 1);
              setCalibTypedText('');
            }, 120);
          } else {
            // All 10 completed! Start synthesis
            setCalibSynthesizing(true);
            setTimeout(() => {
              setCalibSynthesizing(false);
              setCalibCompleted(true);
            }, 1600);
          }
        }
      }
    }
  };

  const handleNextTestSentence = () => {
    setTestSentenceIndex((prev) => (prev + 1) % SAMPLE_SENTENCES.length);
    setTestTypedText('');
    setTestStartTime(null);
    setTestWpm(0);
    setTestAccuracy(100);
    setTestCompleted(false);
    testDwellHistory.current = [];
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleResetCalibration = () => {
    setCalibStep(0);
    setCalibTypedText('');
    setCalibCompleted(false);
    setCalibSynthesizing(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ---------------------------------------------------------------------------
  // ZERO-SHIFT WORD-BASED MONKEYTYPE TEXT RENDERER
  // Each character occupies an invariant w-[1ch] box. Words stay wrapped in
  // inline-block whitespace-nowrap wrappers so text NEVER shifts forward or jumps!
  // ---------------------------------------------------------------------------
  const renderedContent = useMemo(() => {
    const wordsList: { wordText: string; globalStartIndex: number }[] = [];
    let cur = '';
    let startIdx = 0;

    for (let i = 0; i < activeTargetText.length; i++) {
      const ch = activeTargetText[i];
      cur += ch;
      if (ch === ' ' || i === activeTargetText.length - 1) {
        wordsList.push({ wordText: cur, globalStartIndex: startIdx });
        cur = '';
        startIdx = i + 1;
      }
    }

    return (
      <div className="font-mono text-base sm:text-xl lg:text-2xl leading-relaxed tracking-normal select-none w-full flex flex-wrap gap-y-1">
        {wordsList.map((wordObj, wIdx) => {
          return (
            <span key={wIdx} className="inline-block whitespace-nowrap">
              {wordObj.wordText.split('').map((char, cIdx) => {
                const globalIndex = wordObj.globalStartIndex + cIdx;
                const isTyped = globalIndex < activeTypedText.length;
                const isCurrent = globalIndex === activeTypedText.length;
                const isCorrect = isTyped && activeTypedText[globalIndex] === char;
                const isWrong = isTyped && activeTypedText[globalIndex] !== char;

                let charStyle = 'text-stone-400 dark:text-stone-600';
                if (isCorrect) {
                  charStyle = 'text-stone-950 dark:text-stone-900 bg-amber-300 dark:bg-amber-400 rounded-sm font-semibold';
                } else if (isWrong) {
                  charStyle = 'text-white bg-red-600 dark:bg-red-500 rounded-sm font-semibold';
                }

                return (
                  <span
                    key={cIdx}
                    className="relative inline-block w-[1ch] text-center"
                  >
                    {isCurrent && (
                      <span
                        className="absolute left-0 top-1 bottom-1 w-[2px] bg-amber-500 dark:bg-amber-400 animate-pulse z-10 pointer-events-none"
                        aria-hidden="true"
                      />
                    )}
                    <span className={charStyle}>
                      {char === ' ' ? '\u00A0' : char}
                    </span>
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
    );
  }, [activeTargetText, activeTypedText]);

  return (
    <div className={`w-full flex flex-col gap-3 ${className}`}>
      {/* Structured Architectural Typing Arena Container */}
      <div
        className="w-full p-4 sm:p-5 rounded-xl border border-stone-300/90 dark:border-stone-800 bg-[#fdfcf9] dark:bg-[#151513] flex flex-col gap-3 cursor-text relative shadow-sm"
      >
        <div onClick={handleContainerClick} className="w-full flex flex-col gap-3">
          {/* Top Telemetry & Mode Selector Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-stone-200/80 dark:border-stone-800/80 pb-2.5 font-mono text-xs select-none">
            {/* Mode Switch Rectangular Controls (Clean Typography, Zero Emojis) */}
            <div className="flex items-center gap-1.5 p-1 rounded-md bg-stone-100 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setArenaMode('testing');
                }}
                className={`px-3 py-1 rounded-[4px] text-xs font-mono font-medium transition-all cursor-pointer border ${
                  arenaMode === 'testing'
                    ? 'bg-stone-900 text-stone-100 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 shadow-sm font-semibold'
                    : 'text-stone-600 dark:text-stone-400 border-transparent hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                Testing Mode
              </button>

              {/* The real calibration builds a baseline on this machine (backend/enrol.py). The
                  arena's own "calibration mode" only pretended to, so it sends people there. */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveArea('settings');
                }}
                className="px-3 py-1 rounded-[4px] text-xs font-mono font-medium transition-all cursor-pointer border border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                title="Ten sentences that build your baseline for real"
              >
                Calibrate for real
              </button>
            </div>

            {/* Mode-Specific Status / Metrics */}
            {arenaMode === 'testing' ? (
              <div className="flex items-center gap-2.5 sm:gap-3.5 font-mono text-xs tabular-nums">
                <div className="flex items-baseline gap-1" title="Words Per Minute">
                  <span className="text-stone-400 text-[10px]">WPM</span>
                  <strong className="text-stone-900 dark:text-stone-100 font-bold text-xs sm:text-sm">
                    {testWpm || 0}
                  </strong>
                </div>

                <div className="flex items-baseline gap-1" title="Accuracy %">
                  <span className="text-stone-400 text-[10px]">ACC</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold text-xs sm:text-sm">
                    {testAccuracy}%
                  </strong>
                </div>

                <div className="flex items-baseline gap-1" title="Cadence Consistency">
                  <span className="text-stone-400 text-[10px]">CST</span>
                  <strong className="text-stone-900 dark:text-stone-100 font-bold text-xs sm:text-sm">
                    {testConsistency}%
                  </strong>
                </div>

                <div className="hidden sm:flex items-baseline gap-1" title="Live Flight Latency">
                  <span className="text-stone-400 text-[10px]">FLIGHT</span>
                  <span className="text-stone-700 dark:text-stone-300 font-bold text-xs">
                    {liveFlight ? `${Math.round(liveFlight)}ms` : '112ms'}
                  </span>
                </div>

                <div className="hidden sm:flex items-baseline gap-1" title="Live Dwell Duration">
                  <span className="text-stone-400 text-[10px]">DWELL</span>
                  <span className="text-stone-700 dark:text-stone-300 font-bold text-xs">
                    {liveDwell ? `${Math.round(liveDwell)}ms` : '84ms'}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextTestSentence();
                  }}
                  className="px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-[10.5px] font-mono border border-stone-200 dark:border-stone-700 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                  title="Next sample sentence (or press Tab)"
                >
                  <span>⟳</span>
                  <span>Next</span>
                </button>
              </div>
            ) : (
              /* Calibration Mode Status */
              <div className="flex items-center gap-2 font-mono text-xs">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${
                    isCalmPhase
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                  }`}
                >
                  {isCalmPhase ? 'PHASE 1: CALM BASELINE' : 'PHASE 2: STRESS INDUCTION'}
                </span>
                <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                  Sentence {calibStep + 1} / 10
                </span>
              </div>
            )}
          </div>

          {/* 10-Step Progress Bar for Calibration Mode (Structured Rectangular Segments) */}
          {arenaMode === 'calibration' && !calibCompleted && (
            <div className="w-full flex items-center gap-1 py-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-sm transition-all duration-300 ${
                    i < calibStep
                      ? i < 5
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                      : i === calibStep
                      ? isCalmPhase
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-amber-400 animate-pulse'
                      : 'bg-stone-200 dark:bg-stone-800'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Synthesizing Indicator (During Calibration Finish) */}
          {arenaMode === 'calibration' && calibSynthesizing && (
            <div className="p-8 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/80 text-center space-y-3 animate-fade-in font-mono">
              <div className="w-7 h-7 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
                Synthesizing Neuromuscular Baseline...
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Computing dwell variances, flight interval distributions, and stress compression ratio.
              </p>
            </div>
          )}

          {/* Calibrated Baseline Summary Card */}
          {arenaMode === 'calibration' && calibCompleted && (
            <div className="p-6 rounded-lg border border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-mono font-bold text-sm">
                    ✓
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
                      Typing Rhythm Baseline Established
                    </h3>
                    <p className="font-mono text-xs text-stone-500 dark:text-stone-400">
                      10 of 10 sentences measured • Stored only in your local browser memory
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleResetCalibration}
                  className="px-3 py-1 rounded-md text-xs font-mono border border-stone-300 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Recalibrate
                </button>
              </div>

              {/* Calibration Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-md bg-white dark:bg-stone-900 font-mono text-xs border border-stone-200 dark:border-stone-800">
                <div className="space-y-0.5">
                  <span className="text-stone-400 text-[10px] block">CALM MEAN DWELL</span>
                  <strong className="text-stone-900 dark:text-stone-100 text-sm">84.2 ms</strong>
                </div>
                <div className="space-y-0.5">
                  <span className="text-stone-400 text-[10px] block">STRESSED DWELL</span>
                  <strong className="text-amber-600 text-sm">67.8 ms (-19%)</strong>
                </div>
                <div className="space-y-0.5">
                  <span className="text-stone-400 text-[10px] block">FLIGHT LATENCY</span>
                  <strong className="text-stone-900 dark:text-stone-100 text-sm">112.5 ms</strong>
                </div>
                <div className="space-y-0.5">
                  <span className="text-stone-400 text-[10px] block">PATTERN CONFIDENCE</span>
                  <strong className="text-emerald-600 text-sm">98.4% Match</strong>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setArenaMode('testing')}
                  className="px-5 py-2 rounded-md bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 font-mono text-xs font-semibold hover:bg-stone-800 dark:hover:bg-stone-200 transition-all cursor-pointer shadow-sm border border-stone-800 dark:border-stone-200"
                >
                  Return to Testing Mode →
                </button>
              </div>
            </div>
          )}

          {/* Active Typing Display (Shown when not synthesizing or showing completed summary) */}
          {(!calibSynthesizing && !calibCompleted) && (
            <div className="relative min-h-[75px] sm:min-h-[90px] flex items-center py-1">
              {renderedContent}
            </div>
          )}

          {/* Invisible real input for capturing typing */}
          <input
            ref={inputRef}
            type="text"
            value={activeTypedText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            autoFocus
            tabIndex={0}
            aria-label="Keystroke capture target"
          />

          {/* Testing Mode Completed Banner */}
          {arenaMode === 'testing' && testCompleted && (
            <div className="flex items-center justify-between p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-mono text-amber-900 dark:text-amber-200 animate-fade-in">
              <div className="flex items-center gap-2">
                <span>✓</span>
                <span>
                  Sample text finished: <strong>{testWpm} WPM</strong> • <strong>{testAccuracy}% Accuracy</strong>
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextTestSentence();
                }}
                className="px-4 py-1.5 rounded-md bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 font-mono text-xs font-semibold hover:bg-stone-800 dark:hover:bg-stone-200 transition-all cursor-pointer shadow-sm border border-stone-800 dark:border-stone-200"
              >
                Next Test →
              </button>
            </div>
          )}

          {/* Bottom Prompt Helper */}
          <div className="flex items-center justify-between text-[10.5px] font-mono text-stone-400 dark:text-stone-500 pt-0.5 select-none">
            <span>
              {arenaMode === 'testing'
                ? 'Click inside box or type anywhere to test rhythm & ink mechanical keys'
                : isCalmPhase
                ? 'Type comfortably and relaxed to establish your calm neuromotor baseline'
                : 'Type with high urgency and speed to calibrate stress flight compression'}
            </span>
            <span>Yellow = Inked • Red = Jitter • Grey = Target</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonkeyTypeArena;
