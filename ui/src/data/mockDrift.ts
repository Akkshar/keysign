export const mockDriftMetrics = {
  syncPercentage: 98.8,
  driftDelta: '+1.2%',
  driftStatus: 'Within Norm',
  trackingWindowDays: 30,
  motorStability: 'Stable Track (σ=0.08)',
  keyboardProfiles: [
    { name: 'MacBook Pro Magic Keyboard (Built-in)', active: true, syncScore: '99.4%', dwellAvg: '84.2ms', flightAvg: '112.6ms' },
    { name: 'Keychron Q1 Pro (Mechanical 65g switches)', active: false, syncScore: '97.8%', dwellAvg: '96.5ms', flightAvg: '128.1ms' },
    { name: 'Ergonomic Split Alice Layout', active: false, syncScore: '96.2%', dwellAvg: '91.0ms', flightAvg: '120.4ms' }
  ],
  weeklyDriftTrend: [
    { week: 'Week 1', dwell: 83.1, flight: 110.2, sync: 99.2 },
    { week: 'Week 2', dwell: 84.0, flight: 111.8, sync: 99.1 },
    { week: 'Week 3', dwell: 84.9, flight: 113.4, sync: 98.9 },
    { week: 'Week 4 (Current)', dwell: 84.2, flight: 112.6, sync: 99.4 },
  ]
};
