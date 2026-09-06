import { useState, useEffect, useRef, useCallback } from 'react';

export interface ComboMilestone {
  id: number;
  streak: number;
  multiplier: number;
  title: string;
  color: string;
  badge: string;
}

export interface TypingGameState {
  score: number;
  streak: number;
  maxStreak: number;
  comboMultiplier: number;
  wpm: number;
  totalKeystrokes: number;
  activeMilestone: ComboMilestone | null;
  bellTriggered: boolean;
  recentKey: string | null;
}

export const useTypingGame = () => {
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [wpm, setWpm] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [activeMilestone, setActiveMilestone] = useState<ComboMilestone | null>(null);
  const [bellTriggered, setBellTriggered] = useState(false);
  const [recentKey, setRecentKey] = useState<string | null>(null);

  const lastKeyTimeRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyTimestampsRef = useRef<number[]>([]);

  // Combo calculation tiers
  const getMultiplier = (currStreak: number) => {
    if (currStreak >= 50) return 4.0;
    if (currStreak >= 30) return 3.0;
    if (currStreak >= 15) return 2.0;
    if (currStreak >= 5) return 1.5;
    return 1.0;
  };

  const checkMilestone = (newStreak: number): ComboMilestone | null => {
    if (newStreak === 5) {
      return { id: 5, streak: 5, multiplier: 1.5, title: 'Steady Cadence', color: 'text-indigo-400', badge: '⚡ 1.5x' };
    }
    if (newStreak === 15) {
      return { id: 15, streak: 15, multiplier: 2.0, title: 'Flow State!', color: 'text-sky-400', badge: '🔥 2.0x' };
    }
    if (newStreak === 30) {
      return { id: 30, streak: 30, multiplier: 3.0, title: 'Typewriter Virtuoso!', color: 'text-amber-400', badge: '✨ 3.0x' };
    }
    if (newStreak === 50) {
      return { id: 50, streak: 50, multiplier: 4.0, title: 'Hypersonic Maestro!', color: 'text-rose-400', badge: '🌟 4.0x' };
    }
    return null;
  };

  const registerKeyHit = useCallback((key: string) => {
    const now = Date.now();
    setRecentKey(key);
    setTotalKeystrokes((prev) => prev + 1);

    // Calculate rolling WPM over last 15 keystrokes
    keyTimestampsRef.current.push(now);
    if (keyTimestampsRef.current.length > 20) {
      keyTimestampsRef.current.shift();
    }
    if (keyTimestampsRef.current.length > 2) {
      const durationMin = (now - keyTimestampsRef.current[0]) / 60000;
      if (durationMin > 0.005) {
        // approx 5 chars per word
        const words = keyTimestampsRef.current.length / 5;
        const currentWpm = Math.min(Math.round(words / durationMin), 180);
        setWpm(currentWpm);
      }
    }

    // Reset idle timeout (if no key for 1.8s, streak resets)
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setStreak(0);
      setComboMultiplier(1);
      setWpm((prev) => Math.max(0, Math.floor(prev * 0.5)));
    }, 1800);

    setStreak((prevStreak) => {
      const nextStreak = prevStreak + 1;
      const mult = getMultiplier(nextStreak);
      setComboMultiplier(mult);
      setMaxStreak((max) => Math.max(max, nextStreak));

      // Calculate score points (10 base * multiplier)
      const earned = Math.round(10 * mult);
      setScore((s) => s + earned);

      // Check milestones
      const ms = checkMilestone(nextStreak);
      if (ms) {
        setActiveMilestone(ms);
        setTimeout(() => setActiveMilestone(null), 2200);
      }

      return nextStreak;
    });

    lastKeyTimeRef.current = now;
  }, []);

  const triggerBell = useCallback(() => {
    setBellTriggered(true);
    setTimeout(() => setBellTriggered(false), 800);
  }, []);

  const resetGame = useCallback(() => {
    setScore(0);
    setStreak(0);
    setComboMultiplier(1);
    setWpm(0);
    setTotalKeystrokes(0);
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  return {
    score,
    streak,
    maxStreak,
    comboMultiplier,
    wpm,
    totalKeystrokes,
    activeMilestone,
    bellTriggered,
    recentKey,
    registerKeyHit,
    triggerBell,
    resetGame,
  };
};
