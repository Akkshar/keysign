# KeySign UI design notes

The dashboard is the demo. Judges watch it for three minutes while someone
types. Everything on screen must either be real (from a backend tick) or be
labelled as illustrative. Nothing may pretend to be precision.

## What "vibe-coded" looks like here, and what to do instead

- Fake precision: "Gaussian fit 0.98", "Live (0.4ms)", "Threshold delta ±0.8%",
  "Resolution 0.1ms", "42,000 keystroke pairs", "Lockout margin > 25% drop",
  "Zero storage retained", "v2.4a Neural Engine". Remove, or replace with a
  real number from the tick (`live.tick`), the baseline (`/api/baseline`), or
  the heads. If there is no real number, the element goes.
- Jargon badges: three pills in a row, each in a different colour, each saying
  a synonym of "secure". One label per fact. Sentence case. Plain verbs.
- Every card glassy, every card with a glow, every heading with an eyebrow in
  uppercase mono. Eyebrows only where they encode something (a head's name,
  a live/illustrative flag). One accent per card at most.
- Numbered markers only where order carries meaning (the demo beats, a
  timeline). Not on feature grids.

## Tokens (already in tailwind.config.js / index.css)

- Display: Newsreader (serif), medium weight, tight tracking. Headlines only.
- Body: Inter. Data: JetBrains Mono with tabular numerals (`font-telemetry`).
- Ink: on-surface / on-surface-variant. Accent: indigo (primary) for identity,
  emerald (secondary) for calm/ok, amber (tertiary) for load/warn, red (error)
  for alert. A colour means a verdict; never decorative.
- Surfaces: `surface-container-lowest` cards on the `background`. Glass only
  on the header/sidebar.

## Motion rules

- One orchestrated entrance per view: `<Reveal>` (components/motion/Reveal.tsx)
  staggers the top-level cards 60 ms apart, 320 ms, ease-out. Nothing else
  animates on mount.
- Live values move, static values don't: numbers from ticks use
  `AnimatedCounter`; the identity name and verdict labels cross-fade with
  `AnimatePresence`; gauges are springs (RadialGauge already is).
- Hover: `CardSpotlight` on the two or three cards that matter in a view, not
  on all of them. `HoverBorderGradient` on one primary action per view at most.
- Ambient: ShootingStars is global and enough. No extra background loops.
- Respect `prefers-reduced-motion` (Reveal does; framer-motion `useReducedMotion`).

## The signature

The rhythm strip in the header: the last ~40 real inter-key intervals drawn as
a tiny bar strip that beats as you type. It is the product in one glance:
a rhythm that is yours. Everything else stays quiet so it reads.

## Copy

Say what the thing does. "Keystrokes never leave this machine" beats
"Zero-Knowledge Enclave Protocol". If a panel is illustrative, its eyebrow
says "Illustrative" and nothing in it claims to be measured.
