// Two Kenney kits (both CC0), served from /public:
//   racing-kit  — the race cars, start gantry, grandstands, pits, trees...
//   toy-car-kit — still used for the tyres in the tyre walls and the dust puffs.
export const RACING_KIT_URL = '/models/racing-kit'
export const TOY_KIT_URL = '/models/toy-car-kit'

export const racingModelUrl = (name: string) => `${RACING_KIT_URL}/${name}.glb`
export const modelUrl = (name: string) => `${TOY_KIT_URL}/${name}.glb`
