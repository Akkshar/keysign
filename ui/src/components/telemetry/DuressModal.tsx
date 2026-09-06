import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBiometrics } from '../../context/BiometricsContext';

export const DuressModal: React.FC = () => {
  const { duressModalOpen, setDuressModalOpen, setPreset } = useBiometrics();

  const handleDismiss = () => {
    setDuressModalOpen(false);
  };

  const handleRecord = () => {
    setPreset('duress');
    setDuressModalOpen(false);
  };

  return (
    <AnimatePresence>
      {duressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-space-md">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="relative z-10 bg-surface-container-lowest rounded-2xl max-w-lg w-full p-space-xl shadow-2xl border border-surface-container flex flex-col gap-space-lg"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-error border border-red-200 dark:border-red-900/40 duress-alert-pulse">
                  <span className="material-symbols-outlined text-[28px] fill">crisis_alert</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline text-lg font-bold text-on-surface">
                    Simulated Duress Event
                  </span>
                  <span className="font-telemetry text-xs text-error font-medium">
                    SIG_DURESS_COERCION_TEST
                  </span>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleDismiss}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </motion.button>
            </div>

            <div className="flex flex-col gap-space-sm bg-surface-container-low p-space-md rounded-lg border border-surface-container">
              <div className="flex items-center justify-between font-headline text-xs">
                <span className="text-on-surface-variant">Simulated Threat Vector:</span>
                <span className="font-telemetry text-xs text-error font-bold">Physical Hostage Cadence (94.2%)</span>
              </div>
              <div className="flex items-center justify-between font-headline text-xs">
                <span className="text-on-surface-variant">Jitter Variance:</span>
                <span className="font-telemetry text-xs text-error font-semibold">89ms (Δ+77ms)</span>
              </div>
              <div className="flex items-center justify-between font-headline text-xs">
                <span className="text-on-surface-variant">Honeynet Switch:</span>
                <span className="font-telemetry text-xs text-secondary font-medium">DISPATCHED (Silent)</span>
              </div>
            </div>

            <p className="font-body text-xs text-on-surface-variant leading-relaxed">
              This sandbox run validates that the endpoint would have silently initiated SOC beaconing while keeping the local screen benign to an over-the-shoulder assailant.
            </p>

            <div className="flex items-center justify-end gap-space-sm pt-space-xs">
              <button
                onClick={handleDismiss}
                className="px-space-lg py-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline text-xs font-semibold transition-colors"
              >
                Dismiss Simulation
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRecord}
                className="px-space-lg py-space-sm rounded-lg bg-error hover:bg-red-700 text-white font-headline text-xs font-semibold transition-colors shadow-sm"
              >
                Record to Ephemeral Test Buffer
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
