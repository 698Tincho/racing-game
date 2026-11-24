import { CAR_KIT_URL, carKitModelUrl } from './assets'

/**
 * Every Car Kit model is drawn at this size, so cars, trucks and tyres keep
 * their proportions to each other and to the Racing Kit's tents and garages.
 */
export const CAR_SCALE = 1.25

/** The cars you can race. They only differ in looks, so lap times stay comparable. */
export const CARS = [
  { id: 'race', name: 'Formula Red' },
  { id: 'race-future', name: 'Formula Blue' },
  { id: 'sedan-sports', name: 'Sport' },
] as const

export type CarId = (typeof CARS)[number]['id']
export const DEFAULT_CAR: CarId = 'race'

export const isCarId = (value: unknown): value is CarId => CARS.some((c) => c.id === value)
export const carUrl = (id: CarId) => carKitModelUrl(id)
export const carPreviewUrl = (id: CarId) => `${CAR_KIT_URL}/previews/${id}.png`
