import React from 'react';
import { motion, useMotionValue, useMotionTemplate } from 'framer-motion';

interface CardSpotlightProps {
  children: React.ReactNode;
  className?: string;
  radius?: number;
  color?: string;
}

export const CardSpotlight: React.FC<CardSpotlightProps> = ({
  children,
  className = '',
  radius = 240,
  color = 'rgba(99, 102, 241, 0.14)',
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { currentTarget, clientX, clientY } = e;
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`group/spotlight relative overflow-hidden rounded-2xl ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100 z-0"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              ${radius}px circle at ${mouseX}px ${mouseY}px,
              ${color},
              transparent 80%
            )
          `,
        }}
      />
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
};
