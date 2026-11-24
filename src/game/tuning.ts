// All the numbers that decide how the kart feels. Tweak these first.
// Units: meters, seconds, radians.

export const TUNING = {
  // Physics body
  radius: 0.78, // the invisible ball the car rides on, about half the car's width

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

  // Drift: hold full steering and throttle at speed on tarmac and the back
  // steps out. Lift off or straighten up and the tyres catch again.
  driftFromSpeed: 0.5, // starts at this fraction of top speed, fully 0.25 above it
  driftGrip: 0.58, // grip multiplier while fully drifting. Lower = longer slides
  driftTurn: 0.18, // extra turning while fully drifting
  driftBuild: 5, // how fast the slide builds (per second)
  driftRelease: 5, // how fast the tyres catch again (per second)
  driftScrub: 0.16, // speed lost per m/s of sliding, so overdoing it costs time

  // What each surface does to you, as multipliers of the values above.
  // drag = how hard (m/s²) you're slowed down when above that surface's top speed.
  surfaces: {
    road: { maxSpeed: 1, accel: 1, grip: 1, drag: 0 },
    runoff: { maxSpeed: 1, accel: 1, grip: 1, drag: 0 }, // the paved run-off out to the barriers
    pit: { maxSpeed: 1, accel: 1, grip: 1, drag: 0 }, // the pit lane (its speed limit is separate)
    kerb: { maxSpeed: 0.97, accel: 0.95, grip: 0.92, drag: 2 },
    grass: { maxSpeed: 0.5, accel: 0.55, grip: 0.45, drag: 12 },
    gravel: { maxSpeed: 0.3, accel: 0.4, grip: 0.6, drag: 22 },
  },

  // Chase camera
  camDistance: 5.8,
  camHeight: 2.6,
  camFollow: 7, // higher = camera sticks closer
  camLookAhead: 4, // meters in front of the kart the camera aims at
  camLookHeight: 1,
  baseFov: 62,
  speedFov: 12, // extra FOV at top speed

  // High camera: a toy-on-a-table view that turns slowly with the track.
  high: {
    pitch: (35 * Math.PI) / 180, // looking down
    side: 0.32, // radians off to one side, for the three-quarter look
    fov: 40,
    distanceSlow: 14,
    distanceFast: 22, // zooms out as you speed up
    lookAheadSlow: 2,
    lookAheadFast: 4, // metres of track in front of the kart it aims at
    trackAhead: 10, // how far along the track it reads the direction from
    turn: 2.4, // how quickly it turns to follow the track
    follow: 8, // how tightly it trails the kart
    zoom: 1.5, // how quickly the zoom follows your speed
  },
} as const
