/**
 * Illustrative timeline shown only until the State head has emitted a label.
 * Same shape and wording as the live events the backend produces, so the
 * panel does not change character when the real ones arrive.
 */
export const mockStateTimelineEvents = [
  {
    num: 1,
    time: '14:15:02',
    title: 'Engaged',
    color: 'bg-secondary text-on-secondary',
    textColor: 'text-secondary',
    desc: 'load 38/100 · ok to interrupt',
  },
  {
    num: 2,
    time: '14:21:40',
    title: 'Deep Focus',
    color: 'bg-primary text-on-primary',
    textColor: 'text-primary',
    desc: 'load 18/100 · rhythm variance -1.1, corrections -0.8 · defer notifications',
  },
  {
    num: 3,
    time: '14:48:11',
    title: 'High Load',
    color: 'bg-tertiary text-on-tertiary',
    textColor: 'text-tertiary',
    desc: 'load 76/100 · typing speed +1.6, corrections +1.3 · defer notifications',
  },
];
