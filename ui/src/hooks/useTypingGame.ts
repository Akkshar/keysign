import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * The typewriter's own two readouts: a rolling words-per-minute, and the carriage bell.
 *
 * This began as an arcade scoreboard, with streaks, a combo multiplier, points and
 * "Hypersonic Maestro!" banners carrying fire and star emoji. None of it was measured
 * and none of it belonged on a keystroke-security tool, so it is gone. Words per minute
 * survives because it is computed from real timestamps and is the number a typist
 * actually looks for.
 */

const WINDOW_KEYS = 20;      // keystrokes in the rolling window
const CHARS_PER_WORD = 5;    // the usual convention
const IDLE_MS = 1800;        // after this long without a key, the reading decays
const WPM_CEILING = 180;

export const useTypingGame = () => {
  const [wpm, setWpm] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [bellTriggered, setBellTriggered] = useState(false);
  const [recentKey, setRecentKey] = useState<string | null>(null);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyTimestampsRef = useRef<number[]>([]);

  const registerKeyHit = useCallback((key: string) => {
    const now = Date.now();
    setRecentKey(key);
    setTotalKeystrokes((prev) => prev + 1);

    keyTimestampsRef.current.push(now);
    if (keyTimestampsRef.current.length > WINDOW_KEYS) keyTimestampsRef.current.shift();
    if (keyTimestampsRef.current.length > 2) {
      const durationMin = (now - keyTimestampsRef.current[0]) / 60000;
      if (durationMin > 0.005) {
        const words = keyTimestampsRef.current.length / CHARS_PER_WORD;
        setWpm(Math.min(Math.round(words / durationMin), WPM_CEILING));
      }
    }

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      keyTimestampsRef.current = [];
      setWpm(0);
    }, IDLE_MS);
  }, []);

  const triggerBell = useCallback(() => {
    setBellTriggered(true);
    setTimeout(() => setBellTriggered(false), 800);
  }, []);

  const resetGame = useCallback(() => {
    keyTimestampsRef.current = [];
    setWpm(0);
    setTotalKeystrokes(0);
  }, []);

  useEffect(() => () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  return { wpm, totalKeystrokes, bellTriggered, recentKey, registerKeyHit, triggerBell, resetGame };
};
