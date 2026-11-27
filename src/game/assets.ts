// All the 3D models are from Kenney (CC0), served from /public.
//
// Racing Kit: the road, kerbs, barriers, grass, pit garages, tents, billboards,
// lights, trees and flags.
export const RACING_KIT_URL = '/models/racing-kit'

export const racingModelUrl = (name: string) => `${RACING_KIT_URL}/${name}.glb`

// Car Kit: the cars you drive, the parked vehicles and the loose tyres.
export const CAR_KIT_URL = '/models/car-kit'

export const carKitModelUrl = (name: string) => `${CAR_KIT_URL}/${name}.glb`

// Nature Kit: the mountain forest's pines, rocks, cliffs, tents and campfires.
export const NATURE_KIT_URL = '/models/nature-kit'

export const natureModelUrl = (name: string) => `${NATURE_KIT_URL}/${name}.glb`

// City Kit (Commercial): the street circuit's shops, offices and towers.
export const CITY_KIT_URL = '/models/city-kit'

export const cityModelUrl = (name: string) => `${CITY_KIT_URL}/${name}.glb`
