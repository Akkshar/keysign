import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

const KEY_LABELS = [
  'Q', 'W', 'E', 'R', 'T', 'Y',
  'A', 'S', 'D', 'F',
  'Z', 'X', 'C', 'V',
  '1', '2', '3',
  'ESC', 'TAB', 'CTRL',
];

interface FallingKey {
  id: number;
  label: string;
  x: number;
  y: number;
  baseX: number;
  width: number;
  height: number;
  speed: number;
  swaySpeed: number;
  swayAmp: number;
  swayPhase: number;
  rotation: number;
  rotationSpeed: number;
  maxOpacity: number;
}

export const FallingKeys: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Maintain a sparse pool of ~14 keys across the screen
    const KEY_COUNT = 14;

    const createKey = (initialY?: number): FallingKey => {
      const label = KEY_LABELS[Math.floor(Math.random() * KEY_LABELS.length)];
      const isSpecialKey = label.length > 1;
      const keyWidth = isSpecialKey ? 36 + Math.random() * 8 : 24 + Math.random() * 6;
      const keyHeight = 22 + Math.random() * 4;
      const baseX = Math.random() * width;

      return {
        id: Math.random(),
        label,
        x: baseX,
        y: initialY !== undefined ? initialY : -40 - Math.random() * 120,
        baseX,
        width: keyWidth,
        height: keyHeight,
        speed: 0.35 + Math.random() * 0.45, // slow, relaxed descent
        swaySpeed: 0.008 + Math.random() * 0.012,
        swayAmp: 10 + Math.random() * 18,
        swayPhase: Math.random() * Math.PI * 2,
        rotation: (Math.random() - 0.5) * 0.35, // -10° to +10°
        rotationSpeed: (Math.random() - 0.5) * 0.0015,
        maxOpacity: 0.09 + Math.random() * 0.08, // subtle 0.09 to 0.17
      };
    };

    // Stagger initial vertical positions so keys are distributed across height
    const keys: FallingKey[] = Array.from({ length: KEY_COUNT }).map((_, i) =>
      createKey((height / KEY_COUNT) * i + Math.random() * 40)
    );

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // Determine palette based on theme
      // Physical keycap appearance: warm matte plastic with sharp, disciplined corners
      const keyBg = isDark ? 'rgba(38, 37, 34, ' : 'rgba(235, 231, 224, ';
      const keyBorder = isDark ? 'rgba(80, 78, 73, ' : 'rgba(185, 180, 172, ';
      const keyText = isDark ? 'rgba(215, 212, 204, ' : 'rgba(75, 70, 65, ';
      const keyBevel = isDark ? 'rgba(105, 102, 95, ' : 'rgba(255, 255, 255, ';

      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];

        // Motion physics: slow downward fall with subtle sine wave sway
        k.y += k.speed;
        k.swayPhase += k.swaySpeed;
        k.x = k.baseX + Math.sin(k.swayPhase) * k.swayAmp;
        k.rotation += k.rotationSpeed;

        // Calculate fade in at top and fade out near bottom
        let alpha = k.maxOpacity;
        if (k.y < 120) {
          alpha = Math.max(0, (k.y / 120) * k.maxOpacity);
        } else if (k.y > height - 140) {
          alpha = Math.max(0, ((height - k.y) / 140) * k.maxOpacity);
        }

        // Re-spawn when off bottom of screen
        if (k.y > height + 50) {
          keys[i] = createKey(-50);
          continue;
        }

        // Draw physical keycap
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.rotate(k.rotation);

        const w = k.width;
        const h = k.height;
        const radius = 2; // Sharp 2px corner radius

        // 1. Keycap Base Box
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, radius);
        ctx.fillStyle = keyBg + alpha + ')';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = keyBorder + alpha * 1.3 + ')';
        ctx.stroke();

        // 2. Sculpted Top Dish / Bevel Highlight
        ctx.beginPath();
        ctx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 5, 1);
        ctx.strokeStyle = keyBevel + alpha * 0.7 + ')';
        ctx.lineWidth = 0.75;
        ctx.stroke();

        // 3. Monospaced Key Letter Glyph
        ctx.fillStyle = keyText + alpha * 1.6 + ')';
        ctx.font = `${k.label.length > 1 ? '7.5px' : '9.5px'} "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(k.label, 0, -0.5);

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
};

export default FallingKeys;
