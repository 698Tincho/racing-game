// One place for the scene's colours, so the whole look can be re-tuned here.
export const PALETTE = {
  skyTop: '#4fa8f0',
  skyHorizon: '#d4ecff',
  skyBottom: '#c3e2f5', // what you see past the edge of the board
  sun: '#fff0d4',
  sunGlow: '#fff4c2',

  grassLight: '#9ad468',
  grassMid: '#82c45a',
  grassDark: '#6aae4c',
  soil: '#9a6a44',
  soilDark: '#6b4530',
  cloud: '#ffffff',
  dust: '#efe4cf',
} as const

// Fog fades into the horizon colour so far things melt into the sky.
export const FOG = { color: PALETTE.skyHorizon, near: 90, far: 280 }
