import * as THREE from 'three'
import { circuitById } from '../track/circuits'
import { onTrackChange, selectedCircuit } from '../track/layout'

// ---------------------------------------------------------------------------
// The scene's colours and light, one set per venue, so a whole look can be
// re-tuned here. A circuit names its venue (circuits.ts); PALETTE, FOG and
// SUN_DIRECTION are the selected circuit's, and change with it.
// ---------------------------------------------------------------------------

export type Palette = {
  skyTop: string
  skyMid: string
  skyHorizon: string
  skyBottom: string // what you see past the edge of the board
  sun: string
  sunGlow: string
  sunIntensity: number
  hemisphereSky: string
  hemisphereGround: string
  hemisphereIntensity: number
  /** The soft reflections on the car (App's environment). */
  reflections: string
  /** Do the track's light posts shine? (Pools of light at dusk; off in daylight.) */
  lampsOn: boolean
  lamp: string // the track's light posts
  /** The grass around the circuit, when it's not the kit's own colour. */
  ground: string | null
  /** Colours for the Nature Kit's materials, by name (forest venue only). */
  nature: Record<string, string>
  /** The City Kit's windows glow this colour at night (null: dark, by day). */
  windows: string | null

  concrete: string
  dust: string
  tyreSmoke: string
  lotLine: string
}

export type Fog = { color: string; near: number; far: number }

type Venue = { palette: Palette; fog: Fog; sun: THREE.Vector3 }

/** Circuit 01's park, at dusk: deep indigo overhead, through violet, to a warm orange horizon. */
const PARK: Venue = {
  palette: {
    skyTop: '#1f2158',
    skyMid: '#7a4a8c',
    skyHorizon: '#f39a63',
    skyBottom: '#6f4f6c',
    sun: '#ffa768',
    sunGlow: '#ffb478',
    sunIntensity: 2.2,
    hemisphereSky: '#8d90d8',
    hemisphereGround: '#4d4356',
    hemisphereIntensity: 1.75,
    reflections: '#4d467f',
    lampsOn: true,
    lamp: '#ffd59a',
    ground: null,
    nature: {},
    windows: null,
    concrete: '#a9aaa6',
    dust: '#efe4cf',
    tyreSmoke: '#d8d9dd',
    lotLine: '#eceef2',
  },
  // Fog fades into the horizon colour so far things melt into the sky.
  fog: { color: '#c47f72', near: 150, far: 500 },
  // Low over the horizon, so shadows are long, but high enough that they
  // don't stretch across the whole track.
  sun: new THREE.Vector3(-0.62, 0.46, 0.64).normalize(),
}

/** The mountain forest, early in the morning: pale blue sky, a warm haze low down, mist in the trees. */
const FOREST: Venue = {
  palette: {
    skyTop: '#4a7bb6',
    skyMid: '#8db0d3',
    skyHorizon: '#e8dcc2',
    skyBottom: '#7f8f84',
    sun: '#fff0d2',
    sunGlow: '#ffe3ae',
    sunIntensity: 2.4,
    hemisphereSky: '#c3d5ec',
    hemisphereGround: '#4f5a3d',
    hemisphereIntensity: 1.5,
    reflections: '#8aa3c2',
    lampsOn: false,
    lamp: '#ffd59a',
    ground: '#5f8b4d',
    nature: {
      // Pines and leaves: deep, a little blue, so they read as conifers.
      leafsDark: '#3d7550',
      leafsGreen: '#56935a',
      leafsFall: '#d39443',
      // Moss on the rocks and the cliff tops, close to the ground's own green.
      grass: '#79a463',
      // Bark, logs and soil.
      woodBark: '#7a5236',
      woodBarkDark: '#5c3d29',
      wood: '#a8764d',
      woodDark: '#86593a',
      woodInner: '#d9b88d',
      woodBirch: '#e6e0d1',
      dirt: '#8e6b52',
      dirtDark: '#73563f',
      // Grey granite.
      stone: '#a7aba8',
      stoneDark: '#8a8f8d',
      water: '#86c2dc',
      // The fans' tents.
      colorRed: '#c8453b',
      colorRedDark: '#a3362f',
    },
    windows: null,
    concrete: '#a9aaa6',
    dust: '#e6dfcd',
    tyreSmoke: '#d8d9dd',
    lotLine: '#eceef2',
  },
  // Mist: closer than the park's fog, so the far trees fade into it.
  fog: { color: '#c4cfcb', near: 110, far: 480 },
  // Higher, from the other side: morning.
  sun: new THREE.Vector3(0.55, 0.62, -0.56).normalize(),
}

/** The street circuit, at night: a deep blue sky with a glow from the city low down, lamps on, windows lit. */
const CITY: Venue = {
  palette: {
    skyTop: '#060a1c',
    skyMid: '#131a3a',
    skyHorizon: '#4a3352',
    skyBottom: '#17141f',
    // The moon: cool, faint, high.
    sun: '#a9b8ff',
    sunGlow: '#5d6aa8',
    sunIntensity: 0.7,
    hemisphereSky: '#4a5a92',
    hemisphereGround: '#221d2a',
    hemisphereIntensity: 1.05,
    reflections: '#1c2040',
    lampsOn: true,
    lamp: '#ffd59a',
    // Paved: pavements and plazas between the buildings.
    ground: '#5b5e66',
    nature: {},
    windows: '#ffcf86',
    concrete: '#a9aaa6',
    dust: '#cfc8bb',
    tyreSmoke: '#d8d9dd',
    lotLine: '#eceef2',
  },
  // Night haze, lit a little from below by the city.
  fog: { color: '#221c33', near: 120, far: 460 },
  sun: new THREE.Vector3(0.35, 0.8, 0.48).normalize(),
}

const VENUES = { park: PARK, forest: FOREST, city: CITY }
export type VenueId = keyof typeof VENUES

const venueNow = () => VENUES[circuitById(selectedCircuit()).venue]

/** Circuit 01's colours, for things that look the same everywhere (the menu's car). */
export const PARK_PALETTE = PARK.palette

export let PALETTE = venueNow().palette
export let FOG = venueNow().fog
/** Where the sun is: the directional light (shadows) and the sky's glow. */
export let SUN_DIRECTION = venueNow().sun
onTrackChange(() => {
  const venue = venueNow()
  PALETTE = venue.palette
  FOG = venue.fog
  SUN_DIRECTION = venue.sun
})
