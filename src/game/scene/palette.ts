// One place for the scene's colours, so the whole look can be re-tuned here.
export const PALETTE = {
  // Dusk: deep indigo overhead, through violet, to a warm orange horizon.
  skyTop: '#1f2158',
  skyMid: '#7a4a8c',
  skyHorizon: '#f39a63',
  skyBottom: '#6f4f6c', // what you see past the edge of the board
  sun: '#ffa768',
  sunGlow: '#ffb478',

  hemisphereSky: '#8d90d8',
  hemisphereGround: '#4d4356',
  lamp: '#ffd59a', // the track's light posts

  grassLight: '#8fca5e',
  grassMid: '#76b64f',
  grassDark: '#5e9c42',
  concrete: '#a9aaa6',
  soil: '#9a6a44',
  soilDark: '#6b4530',
  dust: '#efe4cf',
  tyreSmoke: '#d8d9dd',

  lotLine: '#eceef2',
} as const

// Fog fades into the horizon colour so far things melt into the sky.
export const FOG = { color: '#c47f72', near: 150, far: 500 }
