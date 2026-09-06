import React from 'react';
import { motion } from 'framer-motion';

interface TextGenerateEffectProps {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}

export const TextGenerateEffect: React.FC<TextGenerateEffectProps> = ({
  words,
  className = '',
  filter = true,
  duration = 0.5,
}) => {
  const wordsArray = words.split(' ');

  return (
    <span className={className}>
      {wordsArray.map((word, idx) => (
        <motion.span
          key={word + idx}
          initial={{
            opacity: 0,
            filter: filter ? 'blur(10px)' : 'none',
            y: 4,
          }}
          animate={{
            opacity: 1,
            filter: filter ? 'blur(0px)' : 'none',
            y: 0,
          }}
          transition={{
            duration: duration,
            delay: idx * 0.1,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};
