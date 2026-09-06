import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Line-style navigation: an index, a tick mark and the label per item.
 * The look of the React Bits LineSidebar without its per-frame pointer
 * tracking, which jittered. Hover and active states are plain CSS
 * transitions; the active tick slides between items with one spring.
 * The active item is controlled by the parent, so it never disagrees
 * with the app's current view.
 */
export interface LineSidebarProps {
  items: string[];
  active: number;
  onItemClick: (index: number, label: string) => void;
  showIndex?: boolean;
  className?: string;
}

export const LineSidebar: React.FC<LineSidebarProps> = ({ items, active, onItemClick, showIndex = true, className = '' }) => {
  const reduce = useReducedMotion();
  return (
    <nav className={`relative select-none ${className}`} aria-label="Primary">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((label, index) => {
          const isActive = index === active;
          return (
            <li key={label} className="relative">
              <button
                type="button"
                onClick={() => onItemClick(index, label)}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-lg py-2 pl-9 pr-3 text-left text-[0.9rem] font-medium tracking-tight transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                  isActive
                    ? 'text-indigo-700 dark:text-sky-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {/* tick mark: short and grey at rest, longer and accented on hover, longest when active */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1/2 h-px -translate-y-1/2 rounded-full transition-all duration-200 ease-out ${
                    isActive
                      ? 'w-7 bg-indigo-600 dark:bg-sky-400'
                      : 'w-4 bg-slate-300 group-hover:w-6 group-hover:bg-slate-400 dark:bg-slate-700 dark:group-hover:bg-slate-500'
                  }`}
                />
                {isActive && (
                  <motion.span
                    layoutId="line-sidebar-active"
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-lg bg-indigo-50/80 dark:bg-slate-800/70"
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <span
                  className={`inline-flex items-baseline transition-transform duration-200 ease-out ${
                    reduce ? '' : isActive ? 'translate-x-1' : 'group-hover:translate-x-1'
                  }`}
                >
                  {showIndex && (
                    <span className={`mr-2.5 font-mono text-[0.72em] tabular-nums ${isActive ? 'opacity-90' : 'opacity-50 group-hover:opacity-80'} transition-opacity`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  )}
                  <span>{label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default LineSidebar;
