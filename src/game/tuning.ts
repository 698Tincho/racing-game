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

  // Chase camera
  camDistance: 6.5,
  camHeight: 2.8,
  camFollow: 6, // higher = camera sticks closer
  baseFov: 55,
  speedFov: 14, // extra FOV at top speed
} as const
