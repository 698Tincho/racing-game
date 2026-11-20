// All the numbers that decide how the kart feels. Tweak these first.
// Units: meters, seconds, radians.

export const TUNING = {
  // Physics body
  radius: 0.6, // the invisible ball the kart rides on

  // Engine
  maxSpeed: 19, // m/s (~68 km/h)
  accel: 17, // how fast you reach top speed
  brake: 34, // deceleration when pressing back while moving forward
  reverseAccel: 12,
  maxReverse: 7,
  coast: 6, // slowdown when no pedal is pressed

  // Steering
  turnRate: 3.1, // rad/s at full lock
  turnFullSpeedAt: 4, // below this speed you can't turn at full rate
  highSpeedTurnLoss: 0.3, // 0 = same turning at top speed, 1 = no turning
  steerResponse: 10, // how quickly the steering input follows the keys

  // Grip: how fast sideways sliding is killed. Lower = more drifty.
  grip: 10,

  // What each surface does to you, as multipliers of the values above.
  // drag = how hard (m/s²) you're slowed down when above that surface's top speed.
  surfaces: {
    road: { maxSpeed: 1, accel: 1, grip: 1, drag: 0 },
    kerb: { maxSpeed: 0.97, accel: 0.95, grip: 0.92, drag: 2 },
    grass: { maxSpeed: 0.5, accel: 0.55, grip: 0.45, drag: 12 },
    gravel: { maxSpeed: 0.3, accel: 0.4, grip: 0.6, drag: 22 },
  },

  // Chase camera
  camDistance: 3.4,
  camHeight: 1.55,
  camFollow: 7, // higher = camera sticks closer
  camLookAhead: 3, // meters in front of the kart the camera aims at
  camLookHeight: 0.7,
  baseFov: 62,
  speedFov: 12, // extra FOV at top speed
} as const
