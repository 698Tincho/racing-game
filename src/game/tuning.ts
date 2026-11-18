// All the numbers that decide how the kart feels. Tweak these first.
// Units: meters, seconds, radians.

export const TUNING = {
  // Physics body
  radius: 0.6, // the invisible ball the kart rides on

  // Engine
  maxSpeed: 24, // m/s (~86 km/h)
  accel: 22, // how fast you reach top speed
  brake: 40, // deceleration when pressing back while moving forward
  reverseAccel: 12,
  maxReverse: 7,
  coast: 6, // slowdown when no pedal is pressed

  // Steering
  turnRate: 2.6, // rad/s at full lock
  turnFullSpeedAt: 6, // below this speed you can't turn at full rate
  highSpeedTurnLoss: 0.35, // 0 = same turning at top speed, 1 = no turning
  steerResponse: 10, // how quickly the steering input follows the keys

  // Grip: how fast sideways sliding is killed. Lower = more drifty.
  grip: 9,

  // What each surface does to you, as multipliers of the values above.
  // drag = how hard (m/s²) you're slowed down when above that surface's top speed.
  surfaces: {
    road: { maxSpeed: 1, accel: 1, grip: 1, drag: 0 },
    kerb: { maxSpeed: 0.96, accel: 0.95, grip: 0.9, drag: 4 },
    grass: { maxSpeed: 0.5, accel: 0.55, grip: 0.45, drag: 12 },
    gravel: { maxSpeed: 0.3, accel: 0.4, grip: 0.6, drag: 22 },
  },

  // Chase camera
  camDistance: 6.5,
  camHeight: 2.8,
  camFollow: 6, // higher = camera sticks closer
  baseFov: 55,
  speedFov: 14, // extra FOV at top speed
} as const
