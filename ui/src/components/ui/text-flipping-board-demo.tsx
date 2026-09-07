import React, { useState, useCallback } from 'react';
import { TextFlippingBoard } from './text-flipping-board';
import { playMechanicalKeyClick } from '../../lib/mechanicalAudio';

// Exact 6 rows x 22 columns:
// Line 1 (row 0): empty
// Line 2 (row 1): "WELCOME" centered in the middle (7 spaces + 7 chars + 8 spaces = 22)
// Line 3 (row 2): "TO" centered in the middle (10 spaces + 2 chars + 10 spaces = 22)
// Line 4 (row 3): "KEYSIGN" centered in the middle (7 spaces + 7 chars + 8 spaces = 22)
// Line 5 (row 4): empty
// Line 6 (row 5): empty
const WELCOME_ROWS: string[] = [
  "                      ",
  "       WELCOME        ",
  "          TO          ",
  "       KEYSIGN        ",
  "                      ",
  "                      ",
];

export function TextFlippingBoardDemo({ className }: { className?: string }) {
  const [flipKey, setFlipKey] = useState<number>(0);
  const lastFlipRef = React.useRef<number>(0);

  const handleReFlip = useCallback(() => {
    const now = Date.now();
    if (now - lastFlipRef.current < 700) return;
    lastFlipRef.current = now;
    setFlipKey((prev) => prev + 1);
    playMechanicalKeyClick(' ');
  }, []);

  return (
    <div className={`w-full flex flex-col items-center ${className ?? ''}`}>
      {/* Interactive Split-Flap Board (Hover or click triggers mechanical flip) */}
      <div
        onClick={handleReFlip}
        onMouseEnter={handleReFlip}
        className="w-full cursor-pointer group transition-transform hover:scale-[1.006] active:scale-[0.996]"
        title="Hover or click to re-flip mechanical board"
      >
        <TextFlippingBoard
          key={flipKey}
          rows={WELCOME_ROWS}
          className="border border-stone-300/80 dark:border-stone-800 bg-[#fdfcf9] dark:bg-[#151513] shadow-lg hover:border-amber-500/50 transition-colors"
        />
      </div>
    </div>
  );
}

export default TextFlippingBoardDemo;
