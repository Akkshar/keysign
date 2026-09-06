import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface HoverBorderGradientProps {
  children: React.ReactNode;
  containerClassName?: string;
  className?: string;
  onClick?: () => void;
  duration?: number;
}

export const HoverBorderGradient: React.FC<HoverBorderGradientProps> = ({
  children,
  containerClassName = '',
  className = '',
  onClick,
  duration = 4,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`relative p-[1.5px] overflow-hidden rounded-full cursor-pointer flex items-center justify-center group ${containerClassName}`}
    >
      {/* Rotating gradient background border */}
      <motion.div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,#4f46e5,#818cf8,transparent_75%)]"
        animate={{
          rotate: hovered ? 360 : 0,
        }}
        transition={{
          duration: hovered ? duration * 0.6 : duration,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          width: '240%',
          height: '240%',
          top: '-70%',
          left: '-70%',
        }}
      />

      {/* Button Interior */}
      <div
        className={`relative z-10 w-full h-full rounded-full transition-all duration-200 ${className}`}
      >
        {children}
      </div>
    </motion.button>
  );
};
