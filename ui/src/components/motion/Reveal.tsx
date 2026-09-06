import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * One orchestrated entrance per view: wrap the top-level cards of a view in
 * <Reveal> and each direct child fades and rises in, staggered. This is the
 * only mount animation a view should have (see ui/DESIGN.md).
 */
export const Reveal: React.FC<{ children: React.ReactNode; className?: string; stagger?: number }> = ({
  children,
  className = '',
  stagger = 0.06,
}) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : stagger } } }}
    >
      {React.Children.map(children, (child, i) =>
        child == null ? null : (
          <motion.div
            key={i}
            variants={{
              hidden: { opacity: 0, y: reduce ? 0 : 10 },
              show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="contents"
          >
            {child}
          </motion.div>
        ),
      )}
    </motion.div>
  );
};

/** Cross-fade a label or name when its value changes (identity, verdicts). */
export const Swap: React.FC<{ value: React.Key; children: React.ReactNode; className?: string }> = ({ value, children, className = '' }) => {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`inline-block ${className}`}
    >
      {children}
    </motion.span>
  );
};
