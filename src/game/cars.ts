import { CAR_KIT_URL, carKitModelUrl } from './assets'

/**
 * Every Car Kit model is drawn at this size, so cars, trucks and tyres keep
 * their proportions to each other and to the Racing Kit's tents and garages.
 */
export const CAR_SCALE = 1.25

/**
 * The cars you can race. They only differ in looks, so lap times stay comparable.
 * Each has a race number and a name, shown big on the menu, and its class.
 */
export const CARS = [
  { id: 'race', number: '07', name: 'Scarlet', kind: 'Open wheel' },
  { id: 'race-future', number: '12', name: 'Cobalt', kind: 'Open wheel' },
  { id: 'sedan-sports', number: '31', name: 'Ember', kind: 'GT sport' },
] as const

export type CarId = (typeof CARS)[number]['id']
export const DEFAULT_CAR: CarId = 'race'

export const isCarId = (value: unknown): value is CarId => CARS.some((c) => c.id === value)
export const carUrl = (id: CarId) => carKitModelUrl(id)
export const carPreviewUrl = (id: CarId) => `${CAR_KIT_URL}/previews/${id}.png`
/** The car rendered from its 3D model, three-quarters from the front, on a clear background: the menu's car picker. */
export const carRenderUrl = (id: CarId) => `/menu/cars/${id}.png`
