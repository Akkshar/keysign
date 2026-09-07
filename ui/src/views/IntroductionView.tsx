import React from 'react';
import { motion } from 'framer-motion';
import { useBiometrics } from '../context/BiometricsContext';
import { TextFlippingBoardDemo } from '../components/ui/text-flipping-board-demo';

interface StoryboardScene {
  id: string;
  stepNumber: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  illustration: React.ReactNode;
}

export const IntroductionView: React.FC = () => {
  const { setActiveArea } = useBiometrics();

  // Scene elements
  const scenes: StoryboardScene[] = [
    {
      id: 'scene-1',
      stepNumber: '01 / HARDWARE_INTERRUPT',
      badge: 'Physical Telemetry',
      title: 'The Sub-Second Kinematics of Typing',
      subtitle: 'Unconscious motor cortex impulses uniquely identify the typist',
      description:
        'Every keystroke generates two discrete hardware events: switch contact (Dwell time) and transition to the next key (Flight time). Governed by deep motor neural pathways, these microsecond temporal intervals form an inimitable physical signature.',
      illustration: (
        <div className="w-full h-44 rounded-lg border border-stone-200/90 dark:border-stone-800/90 bg-[#fdfcf9] dark:bg-[#151513] p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between font-mono text-xs text-stone-500">
            <span>DWELL TIME: 84.2ms</span>
            <span className="text-amber-600 font-semibold">FLIGHT LATENCY: 112.5ms</span>
          </div>
          <svg className="w-full h-24" viewBox="0 0 320 80">
            <line x1="10" y1="60" x2="65" y2="60" stroke="#78716c" strokeWidth="2" />
            <rect x="65" y="18" width="44" height="42" fill="rgba(217,119,6,0.25)" stroke="#d97706" strokeWidth="2" rx="4" />
            <line x1="109" y1="60" x2="190" y2="60" stroke="#78716c" strokeWidth="2" strokeDasharray="4 4" />
            <rect x="190" y="22" width="42" height="38" fill="rgba(217,119,6,0.25)" stroke="#d97706" strokeWidth="2" rx="4" />
            <line x1="232" y1="60" x2="310" y2="60" stroke="#78716c" strokeWidth="2" />
            <text x="73" y="44" fill="#d97706" fontSize="11" fontFamily="monospace" fontWeight="bold">HOLD</text>
            <text x="130" y="52" fill="#78716c" fontSize="10" fontFamily="monospace">FLIGHT</text>
            <text x="198" y="46" fill="#d97706" fontSize="11" fontFamily="monospace" fontWeight="bold">HOLD</text>
          </svg>
          <div className="flex items-center justify-between text-[11px] font-mono text-stone-400">
            <span>Switch Actuation</span>
            <span>Local In-Memory Vector</span>
          </div>
        </div>
      ),
    },
    {
      id: 'scene-2',
      stepNumber: '02 / MECHANICAL_GROUNDING',
      badge: 'Tactile Simulation',
      title: 'Physical Grounding via 3D Typewriter',
      subtitle: 'Visible mechanical verification for invisible behavioral biometrics',
      description:
        'To demonstrate that physical hardware actuation drives the telemetry, a real-time 3D mechanical typewriter strikes individual QWERTY keys, advances its carriage, and inks paper in 1:1 synchronization with the typist.',
      illustration: (
        <div className="w-full h-44 rounded-lg border border-stone-200/90 dark:border-stone-800/90 bg-[#fdfcf9] dark:bg-[#151513] p-4 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
          <div className="relative z-10 text-center space-y-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              1:1 Physical Kinematics
            </span>
            <h4 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-base">
              Real-Time Mechanical Response
            </h4>
            <p className="font-mono text-xs text-stone-500 dark:text-stone-400">
              Typebar Strikes • Platen Carriage • Live Paper Inking
            </p>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
        </div>
      ),
    },
    {
      id: 'scene-3',
      stepNumber: '03 / CLINICAL_NEUROMOTOR',
      badge: 'Neuromotor Screening',
      title: 'Neuromotor Biomarkers & Typing Stability',
      subtitle: 'Subtle timing patterns that reflect motor cortex stability',
      description:
        'Continuous analysis of sub-second hold times and micro-interval variances screens for subtle motor shifts associated with tremor, fatigue, and cognitive pausing.',
      illustration: (
        <div className="w-full h-44 rounded-lg border border-stone-200/90 dark:border-stone-800/90 bg-[#fdfcf9] dark:bg-[#151513] p-4 flex flex-col justify-between shadow-sm font-mono">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>MOTOR TREMOR SPECTRUM (4–7 Hz)</span>
            <span className="text-emerald-600 font-bold">NOMINAL BAND</span>
          </div>
          <div className="flex items-end justify-between gap-1.5 h-20 px-2 py-1">
            {[32, 45, 72, 86, 50, 28, 32, 70, 46, 38, 24, 52, 30].map((val, i) => (
              <div
                key={i}
                className="w-full bg-amber-600/80 rounded-t-xs transition-all hover:bg-amber-600"
                style={{ height: `${val}%` }}
              />
            ))}
          </div>
          <span className="text-[11px] text-stone-400 text-center">Fast Fourier Transform of inter-key latency</span>
        </div>
      ),
    },
    {
      id: 'scene-4',
      stepNumber: '04 / ZERO_KNOWLEDGE',
      badge: 'Zero Keylogging',
      title: 'Zero-Knowledge Privacy by Design',
      subtitle: 'Mathematically impossible to reconstruct typed text or credentials',
      description:
        'Characters, credentials, and message content are stripped at the hardware driver boundary. Only raw millisecond interval deltas exist in memory, providing an unassailable privacy guarantee.',
      illustration: (
        <div className="w-full h-44 rounded-lg border border-stone-200/90 dark:border-stone-800/90 bg-[#fdfcf9] dark:bg-[#151513] p-4 flex items-center justify-around font-mono text-center shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-stone-500">STEP 1</span>
            <span className="block text-[11px] text-stone-400">Switch Contact</span>
            <strong className="text-xs text-stone-800 dark:text-stone-200">Text Discarded</strong>
          </div>
          <span className="text-stone-400 text-lg">➔</span>
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-amber-600">STEP 2</span>
            <span className="block text-[11px] text-amber-600 font-bold">Delta Timing</span>
            <strong className="text-xs text-stone-800 dark:text-stone-200">Millisecond Only</strong>
          </div>
          <span className="text-stone-400 text-lg">➔</span>
          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-emerald-600">STEP 3</span>
            <span className="block text-[11px] text-emerald-600 font-bold">Rhythm Match</span>
            <strong className="text-xs text-stone-800 dark:text-stone-200">Verified Identity</strong>
          </div>
        </div>
      ),
    },
  ];

  const handleScrollToDashboard = () => {
    // In the story flow the dashboard is further down the same page; on its own, it is a view.
    const el = document.getElementById('dashboard-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setActiveArea('overview');
  };

  return (
    <div
      className="w-full max-w-5xl mx-auto flex flex-col gap-16 sm:gap-24 py-6 sm:py-12 select-none font-sans relative"
    >

      {/* 1. Opening Marquee: Interactive Split-Flap Board (Displays KEYSIGN on load) */}
      <motion.section
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="w-full flex flex-col items-center gap-3 pt-2 pb-6"
      >
        <TextFlippingBoardDemo />
      </motion.section>

      {/* 2. Hero Pitch Header */}
      <motion.section
        initial={{ opacity: 0, y: 35 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="text-center space-y-5 max-w-3xl mx-auto px-4"
      >

        <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          KeySign
        </h1>

        <p className="font-serif italic text-2xl sm:text-3xl text-stone-600 dark:text-stone-400 max-w-2xl mx-auto leading-tight">
          "Your keyboard has a signature. We measure the signature, not what you type."
        </p>

        <p className="font-sans text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-xl mx-auto leading-relaxed pt-1">
          Continuous identity authentication and clinical neuromotor screening operating completely in local memory without recording text.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            onClick={handleScrollToDashboard}
            className="px-6 py-2.5 rounded-md bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 font-mono text-xs uppercase tracking-wider font-semibold hover:bg-stone-800 dark:hover:bg-stone-200 transition-all cursor-pointer shadow-sm border border-stone-800 dark:border-stone-200 flex items-center gap-2"
          >
            <span>Enter Live Telemetry Dashboard</span>
            <span>↓</span>
          </button>
        </div>

        <div className="pt-6 text-stone-400 dark:text-stone-600 flex flex-col items-center gap-1 font-mono text-xs animate-bounce">
          <span>Scroll to explore the architecture</span>
          <span>↓</span>
        </div>
      </motion.section>

      {/* 3. Scrollytelling Storyboard Scenes */}
      <section className="space-y-12 sm:space-y-16">
        {scenes.map((scene, idx) => (
          <motion.div
            key={scene.id}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{
              duration: 0.7,
              delay: 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="p-6 sm:p-10 rounded-xl border border-stone-200 dark:border-stone-800 bg-[#fdfcf9] dark:bg-[#141412] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-sm hover:shadow-sm transition-all"
          >
            {/* Text Narrative */}
            <div className="lg:col-span-6 space-y-3">
              <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400">
                {scene.stepNumber.split(' / ')[0]}
              </span>

              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
                {scene.title}
              </h2>

              <h3 className="font-serif italic text-sm text-stone-500 dark:text-stone-400">
                {scene.subtitle}
              </h3>

              <p className="text-xs sm:text-sm font-sans text-stone-600 dark:text-stone-400 leading-relaxed pt-1">
                {scene.description}
              </p>
            </div>

            {/* Visual Telemetry Illustration */}
            <div className="lg:col-span-6">
              {scene.illustration}
            </div>
          </motion.div>
        ))}
      </section>

      {/* 3. Project Summary */}
      <motion.section
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7 }}
        className="p-6 sm:p-8 rounded-xl border border-stone-200 dark:border-stone-800 bg-[#fdfcf9] dark:bg-[#151513] space-y-4 shadow-sm"
      >
        <div className="border-b border-stone-200/80 dark:border-stone-800/80 pb-3">
          <h3 className="font-serif text-xl font-medium text-stone-900 dark:text-stone-100">
            Project Summary
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 font-mono text-xs text-stone-600 dark:text-stone-400">
          <div className="space-y-1.5">
            <strong className="text-stone-900 dark:text-stone-100 block text-sm font-serif">
              1. Zero Keylogging Guarantee
            </strong>
            <p className="leading-relaxed text-[11px]">
              Strict mathematical guarantee that characters are stripped at the hardware interrupt boundary before behavioral analysis. No sensitive text ever leaves local memory.
            </p>
          </div>
          <div className="space-y-1.5">
            <strong className="text-stone-900 dark:text-stone-100 block text-sm font-serif">
              2. Clinical Neuromotor Screening
            </strong>
            <p className="leading-relaxed text-[11px]">
              Passive evaluation for 6 neuro-functional conditions: Parkinson's, Alzheimer's, Mild Cognitive Impairment (MCI), Multiple Sclerosis, Depression, and Bipolar motor manifestations.
            </p>
          </div>
          <div className="space-y-1.5">
            <strong className="text-stone-900 dark:text-stone-100 block text-sm font-serif">
              3. Physical 3D Kinematics
            </strong>
            <p className="leading-relaxed text-[11px]">
              WebGL vintage mechanical typewriter physically striking keys and inking real paper in exact 1:1 synchronization with the typist's keyboard input.
            </p>
          </div>
        </div>
      </motion.section>
    </div>
  );
};
